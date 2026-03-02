import {z} from 'zod';
import type {
    MessageParam,
    Tool,
    ToolResultBlockParam,
    ContentBlock,
} from '@anthropic-ai/sdk/resources/messages';
import {router, publicProcedure} from '../trpc.mjs';
import {
    assistantBlockSchema,
    userBlockSchema,
} from '#core/trpc/routers/conversation.mjs';
import {generateId, toDBId} from '#core/db/id.mjs';
import type {TBlockType, TConversationModel} from '#core/db/overrides.mjs';
import type {TSelectableBlock} from '#core/db/types.mjs';

// ── Input/Output Schemas ────────────────────────────────────

const converseInputSchema = z.object({
    conversation_id: z.string(),
    system_prompt: z.string(),
    context: z.array(
        z.object({
            title: z.string().optional(),
            content: z.string(),
        }),
    ),
    available_tools: z.array(
        z.object({
            definition: z.string(),
        }),
    ),
    variables_object_definition: z.string(),
    blocks: z.array(userBlockSchema),
});

const converseOutputSchema = z.object({
    blocks: z.array(assistantBlockSchema),
});

type TUserBlock = z.infer<typeof userBlockSchema>;
type TAssistantBlock = z.infer<typeof assistantBlockSchema>;

// ── Constants ───────────────────────────────────────────────

const API_MODEL = 'claude-sonnet-4-20250514';
const DB_MODEL: TConversationModel = 'claude-sonnet-4.6';
const MAX_TOKENS = 16384;
const MAX_CONSECUTIVE_PATCH_FAILURES = 3;

// ── Anthropic Tool Definitions ──────────────────────────────

const WRITE_AND_RUN_JS_TOOL: Tool = {
    name: 'write_and_run_js',
    description: 'Write and execute JavaScript code on the page',
    input_schema: {
        type: 'object' as const,
        properties: {
            js_code: {
                type: 'string',
                description: 'The JavaScript code to execute',
            },
        },
        required: ['js_code'],
    },
};

const PATCH_AND_RUN_JS_TOOL: Tool = {
    name: 'patch_and_run_js',
    description:
        'Apply a unified diff patch to the most recently executed code and re-run it',
    input_schema: {
        type: 'object' as const,
        properties: {
            js_code_diff_patch: {
                type: 'string',
                description:
                    'A unified diff patch to apply to the previous code',
            },
        },
        required: ['js_code_diff_patch'],
    },
};

// ── Block Type Mapping ──────────────────────────────────────

const userBlockToDBType = (block: TUserBlock): TBlockType =>
    block.type === 'execution_result' ? 'tool_result' : 'text';

const userBlockToPayload = (block: TUserBlock): unknown =>
    block.type === 'execution_result'
        ? {
              execution_identifier: block.execution_identifier,
              result: block.result,
              error: block.error,
          }
        : {message: block.message};

// ── Patch Failure Tracking ──────────────────────────────────

const countConsecutivePatchFailures = (
    blocks: readonly TSelectableBlock[],
): number => {
    let count = 0;

    // Group blocks by turn for analysis
    const blocksByType = blocks.reduce<{
        toolUse: Map<string, TSelectableBlock>;
        toolResult: TSelectableBlock[];
    }>(
        (acc, block) => {
            if (block.type === 'tool_use') {
                const payload = block.payload as {execution_identifier: string};
                acc.toolUse.set(payload.execution_identifier, block);
            } else if (block.type === 'tool_result') {
                acc.toolResult = [...acc.toolResult, block];
            }
            return acc;
        },
        {toolUse: new Map(), toolResult: []},
    );

    // Walk backwards through tool_result blocks
    const sortedResults = [...blocksByType.toolResult].sort(
        (a, b) => b.created_at.getTime() - a.created_at.getTime(),
    );

    for (const resultBlock of sortedResults) {
        const payload = resultBlock.payload as {
            execution_identifier: string;
            error: string | null;
        };

        if (!payload.error) {
            break; // Success found, stop counting
        }

        const toolUseBlock = blocksByType.toolUse.get(
            payload.execution_identifier,
        );
        if (!toolUseBlock) {
            break;
        }

        const toolPayload = toolUseBlock.payload as {description: string};
        if (toolPayload.description === 'patch_and_run_js') {
            count++;
        } else {
            break; // Non-patch tool found, stop counting
        }
    }

    return count;
};

// ── Message Construction ────────────────────────────────────

const buildUserContent = (
    blocks: readonly TUserBlock[],
): ({type: 'text'; text: string} | ToolResultBlockParam)[] =>
    blocks.map((block) =>
        block.type === 'execution_result'
            ? ({
                  type: 'tool_result',
                  tool_use_id: block.execution_identifier,
                  content: block.error
                      ? `${block.result}\n--- ERROR ---\n${block.error}`
                      : block.result,
                  is_error: block.error !== null,
              } as ToolResultBlockParam)
            : {type: 'text', text: block.message},
    );

const buildContextSection = (
    context: readonly {readonly title?: string; readonly content: string}[],
): string =>
    context.length === 0
        ? ''
        : `<current_context>\n${context
              .map((c) =>
                  c.title
                      ? `<${c.title}>\n${c.content}\n</${c.title}>`
                      : c.content,
              )
              .join('\n\n')}\n</current_context>\n\n`;

// ── Router ──────────────────────────────────────────────────

export const converseRouter = router({
    converse: publicProcedure
        .input(converseInputSchema)
        .output(converseOutputSchema)
        .mutation(async ({ctx, input}) => {
            const {db, anthropic, template, code} = ctx.services;
            const now = new Date();
            const conversationDBId = toDBId(input.conversation_id);

            // 1. Check if conversation exists
            const existingConversation = await db
                .selectFrom('conversations')
                .select('id')
                .where('id', '=', conversationDBId)
                .executeTakeFirst();

            // 2. Create or update conversation
            existingConversation
                ? await db
                      .updateTable('conversations')
                      .set({
                          last_turn_by: 'user',
                          last_message_at: now,
                      })
                      .where('id', '=', conversationDBId)
                      .execute()
                : await db
                      .insertInto('conversations')
                      .values({
                          id: conversationDBId,
                          last_turn_by: 'user',
                          last_message_at: now,
                          model: DB_MODEL,
                      })
                      .execute();

            // 3. Create user turn
            const userTurnId = generateId();
            const userTurnDBId = toDBId(userTurnId);

            await db
                .insertInto('turns')
                .values({
                    id: userTurnDBId,
                    conversation_id: conversationDBId,
                    actor: 'user',
                })
                .execute();

            // 4. Insert user blocks
            const userBlockInserts = input.blocks.map((block) => ({
                id: toDBId(generateId()),
                conversation_id: conversationDBId,
                turn_id: userTurnDBId,
                type: userBlockToDBType(block),
                payload: JSON.stringify(userBlockToPayload(block)),
            }));

            userBlockInserts.length > 0 &&
                (await db
                    .insertInto('blocks')
                    .values(userBlockInserts)
                    .execute());

            // 5. Fetch existing conversation history (excluding current turn)
            const existingTurns = await db
                .selectFrom('turns')
                .selectAll()
                .where('conversation_id', '=', conversationDBId)
                .where('id', '!=', userTurnDBId)
                .orderBy('created_at', 'asc')
                .execute();

            const existingTurnIds = existingTurns.map((t) => t.id);

            const existingBlocks =
                existingTurnIds.length > 0
                    ? await db
                          .selectFrom('blocks')
                          .selectAll()
                          .where('turn_id', 'in', existingTurnIds)
                          .orderBy('created_at', 'asc')
                          .execute()
                    : [];

            // 6. Find last code block for patching
            const lastCodeBlock = [...existingBlocks]
                .filter((b) => b.type === 'tool_use')
                .sort(
                    (a, b) => b.created_at.getTime() - a.created_at.getTime(),
                )[0];

            const lastCode = lastCodeBlock
                ? String((lastCodeBlock.payload as {code: string}).code ?? '')
                : null;

            // 7. Check consecutive patch failures
            const patchFailures = countConsecutivePatchFailures(existingBlocks);
            const shouldDisablePatch =
                patchFailures >= MAX_CONSECUTIVE_PATCH_FAILURES;

            // 8. Build messages array
            const blocksByTurnId = existingBlocks.reduce<
                Record<string, typeof existingBlocks>
            >((acc, block) => {
                const existing = acc[block.turn_id] ?? [];
                return {...acc, [block.turn_id]: [...existing, block]};
            }, {});

            const historyMessages: MessageParam[] = await Promise.all(
                existingTurns.map(async (turn) => {
                    const turnBlocks = blocksByTurnId[turn.id] ?? [];

                    if (turn.actor === 'user') {
                        return {
                            role: 'user' as const,
                            content: turnBlocks.map((b) => {
                                const p = b.payload as Record<string, unknown>;
                                return b.type === 'tool_result'
                                    ? ({
                                          type: 'tool_result',
                                          tool_use_id: String(
                                              p.execution_identifier ?? '',
                                          ),
                                          content: p.error
                                              ? `${p.result}\n--- ERROR ---\n${p.error}`
                                              : String(p.result ?? ''),
                                          is_error: p.error !== null,
                                      } as ToolResultBlockParam)
                                    : {
                                          type: 'text' as const,
                                          text: String(p.message ?? ''),
                                      };
                            }),
                        };
                    }

                    // Assistant turn - format code with line numbers
                    // Filter out thinking blocks as they're model-generated, not sent to API
                    const validBlocks = turnBlocks.filter(
                        (b) => b.type === 'tool_use' || b.type === 'text',
                    );

                    const formattedContent = await Promise.all(
                        validBlocks.map(async (b) => {
                            const p = b.payload as Record<string, unknown>;
                            if (b.type === 'tool_use') {
                                const codeWithLines =
                                    await code.formatWithLineNumbers(
                                        String(p.code ?? ''),
                                    );
                                return {
                                    type: 'tool_use' as const,
                                    id: String(p.execution_identifier ?? ''),
                                    name: String(p.description ?? ''),
                                    input: {js_code: codeWithLines},
                                };
                            }
                            return {
                                type: 'text' as const,
                                text: String(p.message ?? ''),
                            };
                        }),
                    );

                    return {
                        role: 'assistant' as const,
                        content: formattedContent,
                    };
                }),
            );

            // Add current user message
            const currentUserMessage: MessageParam = {
                role: 'user',
                content: buildUserContent(input.blocks),
            };

            // Build operator prompt as synthetic exchange
            const operatorMessages: MessageParam[] = input.system_prompt
                ? [
                      {role: 'user', content: input.system_prompt},
                      {role: 'assistant', content: 'Understood.'},
                  ]
                : [];

            const messages: MessageParam[] = [
                ...operatorMessages,
                ...historyMessages,
                currentUserMessage,
            ];

            // 9. Render system prompt
            const toolTypes = input.available_tools
                .map((t) => t.definition)
                .join('\n\n');

            const contextSection = buildContextSection(input.context);

            const systemPromptBase = await template.renderSystemPrompt({
                page_tool_types: toolTypes,
                page_variable_types: input.variables_object_definition,
            });

            const systemPrompt = contextSection + systemPromptBase;

            // 10. Build tools array
            const tools: Tool[] = shouldDisablePatch
                ? [WRITE_AND_RUN_JS_TOOL]
                : [WRITE_AND_RUN_JS_TOOL, PATCH_AND_RUN_JS_TOOL];

            // Add patch failure warning to system prompt if needed
            const finalSystemPrompt = shouldDisablePatch
                ? `${systemPrompt}\n\n<important_notice>\nPatching has failed ${patchFailures} times consecutively. The patch_and_run_js tool has been disabled. You MUST use write_and_run_js to write fresh code.\n</important_notice>`
                : systemPrompt;

            // 11. Call Anthropic API
            const response = await anthropic.createMessage({
                model: API_MODEL,
                system: finalSystemPrompt,
                messages,
                max_tokens: MAX_TOKENS,
                tools,
            });

            // 12. Process response - handle tool_use blocks
            const processedBlocks: {
                dbPayload: unknown;
                dbType: TBlockType;
                outputBlock: TAssistantBlock | null;
            }[] = await Promise.all(
                response.content.map(async (block: ContentBlock) => {
                    if (block.type === 'tool_use') {
                        const toolName = block.name;
                        const input = block.input as {
                            js_code?: string;
                            js_code_diff_patch?: string;
                        };

                        let cleanCode: string;

                        if (toolName === 'write_and_run_js') {
                            cleanCode = input.js_code ?? '';
                        } else if (toolName === 'patch_and_run_js') {
                            if (!lastCode) {
                                throw new Error('No previous code to patch');
                            }
                            const patch = input.js_code_diff_patch ?? '';
                            cleanCode = code.applyPatch(lastCode, patch);
                        } else {
                            throw new Error(`Unknown tool: ${toolName}`);
                        }

                        return {
                            dbPayload: {
                                execution_identifier: block.id,
                                description: toolName,
                                code: cleanCode,
                            },
                            dbType: 'tool_use' as TBlockType,
                            outputBlock: {
                                type: 'execution' as const,
                                execution_identifier: block.id,
                                description: toolName,
                                code: cleanCode,
                            },
                        };
                    }

                    if (block.type === 'text') {
                        return {
                            dbPayload: {message: block.text},
                            dbType: 'text' as TBlockType,
                            outputBlock: {
                                type: 'text' as const,
                                message: block.text,
                            },
                        };
                    }

                    if (block.type === 'thinking') {
                        return {
                            dbPayload: {thinking: block.thinking},
                            dbType: 'thinking' as TBlockType,
                            outputBlock: {
                                type: 'thinking' as const,
                                thinking: block.thinking,
                            },
                        };
                    }

                    // Handle other block types (redacted_thinking, etc.)
                    return {
                        dbPayload: block,
                        dbType: 'text' as TBlockType,
                        outputBlock: null,
                    };
                }),
            );

            // 13. Update conversation with assistant turn
            await db
                .updateTable('conversations')
                .set({
                    last_turn_by: 'assistant',
                    last_message_at: new Date(),
                })
                .where('id', '=', conversationDBId)
                .execute();

            // 14. Create assistant turn
            const assistantTurnId = generateId();
            const assistantTurnDBId = toDBId(assistantTurnId);

            await db
                .insertInto('turns')
                .values({
                    id: assistantTurnDBId,
                    conversation_id: conversationDBId,
                    actor: 'assistant',
                })
                .execute();

            // 15. Insert assistant blocks
            const assistantBlockInserts = processedBlocks.map((processed) => ({
                id: toDBId(generateId()),
                conversation_id: conversationDBId,
                turn_id: assistantTurnDBId,
                type: processed.dbType,
                payload: JSON.stringify(processed.dbPayload),
            }));

            assistantBlockInserts.length > 0 &&
                (await db
                    .insertInto('blocks')
                    .values(assistantBlockInserts)
                    .execute());

            // 16. Return assistant blocks
            const outputBlocks = processedBlocks
                .map((p) => p.outputBlock)
                .filter((b): b is TAssistantBlock => b !== null);

            return {blocks: outputBlocks};
        }),
});

export type TConverseRouter = typeof converseRouter;
