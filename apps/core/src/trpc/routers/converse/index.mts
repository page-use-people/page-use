import type {MessageParam, Tool} from '@anthropic-ai/sdk/resources/messages';
import {router, publicProcedure} from '#core/trpc/trpc.mjs';
import {generateId, toDBId, toDBIdSafe} from '#core/db/id.mjs';
import {
    converseInputSchema,
    converseOutputSchema,
    API_MODEL,
    DB_MODEL,
    MAX_TOKENS,
    MAX_CONSECUTIVE_EDIT_FAILURES,
    MAX_CONSECUTIVE_FAILED_EXECUTION_TURNS,
    MAX_AGENT_TURNS,
    WRITE_AND_RUN_JS_TOOL,
    EDIT_AND_RUN_JS_TOOL,
} from './schemas.mjs';
import type {TAssistantBlock} from './schemas.mjs';
import {
    userBlockToDBType,
    userBlockToPayload,
    countConsecutiveEditFailures,
    processResponseBlocks,
} from './blocks.mjs';
import {
    buildUserContent,
    buildContextSection,
    sanitizeMessages,
    buildHistoryMessages,
    buildCachedSystemPrompt,
    markLastMessageForCaching,
    applyForceStop,
} from './messages.mjs';
import {
    guardAgentProcessing,
    countAgentTurnsSinceLastUserTurn,
    countConsecutiveFailedExecutionTurns,
    getRunSegmentSinceLastTrueUserTurn,
} from './guards.mjs';

// ── Router ──────────────────────────────────────────────────

export const converseRouter = router({
    converse: publicProcedure
        .input(converseInputSchema)
        .output(converseOutputSchema)
        .mutation(async ({ctx, input}) => {
            const {db, anthropic, template, code} = ctx.services;
            const now = new Date();
            const conversationDBId = toDBIdSafe(input.conversation_id);

            // 0. Guard: block user turns while agent is processing
            const isTrueUserTurn = input.blocks.every(
                (block) => block.type === 'text',
            );

            if (isTrueUserTurn) {
                await guardAgentProcessing(db, conversationDBId);
            }

            // 1. Create or update conversation
            const existingConversation = await db
                .selectFrom('conversations')
                .select('id')
                .where('id', '=', conversationDBId)
                .executeTakeFirst();

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

            // 2. Create user turn + blocks
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

            // 3. Fetch conversation history
            const existingTurns = await db
                .selectFrom('turns')
                .selectAll()
                .where('conversation_id', '=', conversationDBId)
                .where('id', '!=', userTurnDBId)
                .orderBy('created_at', 'asc')
                .orderBy('id', 'asc')
                .execute();

            const existingTurnIds = existingTurns.map((t) => t.id);

            const existingBlocks =
                existingTurnIds.length > 0
                    ? await db
                          .selectFrom('blocks')
                          .selectAll()
                          .where('turn_id', 'in', existingTurnIds)
                          .orderBy('created_at', 'asc')
                          .orderBy('id', 'asc')
                          .execute()
                    : [];

            const runSegment = getRunSegmentSinceLastTrueUserTurn(
                isTrueUserTurn,
                existingTurns,
                existingBlocks,
            );

            // 4. Count execution budgets
            const agentTurnBudget = countAgentTurnsSinceLastUserTurn(
                runSegment.turns,
            );
            const failedExecutionTurnBudget =
                countConsecutiveFailedExecutionTurns(
                    runSegment.turns,
                    runSegment.blocks,
                    input.blocks,
                );
            const forceStopReason = agentTurnBudget.isForceStop
                ? ('max_agent_turns' as const)
                : failedExecutionTurnBudget.isForceStop
                  ? ('failed_execution_turns' as const)
                  : null;

            // 5. Find last code block for editing
            const lastCodeBlock = [...existingBlocks]
                .filter((b) => b.type === 'tool_use')
                .sort(
                    (a, b) =>
                        b.created_at.getTime() - a.created_at.getTime() ||
                        b.id.localeCompare(a.id),
                )[0];

            const lastCode = lastCodeBlock
                ? String((lastCodeBlock.payload as {code: string}).code ?? '')
                : null;

            // 6. Check consecutive edit failures
            const editFailures = countConsecutiveEditFailures(
                runSegment.blocks,
                input.blocks,
            );
            const shouldDisableEdit =
                forceStopReason === null &&
                editFailures >= MAX_CONSECUTIVE_EDIT_FAILURES;

            // 7. Build messages
            const blocksByTurnId = existingBlocks.reduce<
                Record<string, typeof existingBlocks>
            >((acc, block) => {
                const existing = acc[block.turn_id] ?? [];
                return {...acc, [block.turn_id]: [...existing, block]};
            }, {});

            const historyMessages = buildHistoryMessages(
                existingTurns,
                blocksByTurnId,
            );

            const currentUserContent = buildUserContent(input.blocks);
            const currentUserMessage: MessageParam = {
                role: 'user',
                content:
                    forceStopReason === null && !isTrueUserTurn
                        ? [
                              ...currentUserContent,
                              {
                                  type: 'text' as const,
                                  text: `[System: You have ${failedExecutionTurnBudget.turnsRemaining} consecutive failed execution turn(s) remaining before you must stop if failures continue.]`,
                              },
                          ]
                        : currentUserContent,
            };

            const operatorMessages: MessageParam[] = input.system_prompt
                ? [
                      {role: 'user', content: input.system_prompt},
                      {role: 'assistant', content: 'Understood.'},
                  ]
                : [];

            const messages: MessageParam[] = sanitizeMessages([
                ...operatorMessages,
                ...historyMessages,
                currentUserMessage,
            ]);

            // 8. Render system prompt
            const toolTypes = input.available_tools
                .map((t) => t.definition)
                .join('\n\n');

            const contextSection = buildContextSection(input.context);

            const systemPromptBase = await template.renderSystemPrompt({
                page_tool_types: toolTypes,
                page_variable_types: input.variables_object_definition,
            });

            const stableSystemPrompt =
                contextSection + systemPromptBase;

            const dynamicSystemPrompt =
                `\n\n<execution_limits>\nYou have a maximum of ${MAX_AGENT_TURNS} total execution turns to fulfill a single user request. This is a hard backstop.\nYou also have a maximum of ${MAX_CONSECUTIVE_FAILED_EXECUTION_TURNS} consecutive failed execution turns. A failed execution turn is a follow-up turn where every execution result is an error.\nAny successful execution result resets the consecutive failed execution turn counter to 0.\nBudget your attempts carefully. If you exhaust either limit, you must stop using tools and apologize to the user.\n</execution_limits>` +
                (shouldDisableEdit && forceStopReason === null
                    ? `\n\n<important_notice>\nEditing has failed ${editFailures} times consecutively. The edit_and_run_js tool has been disabled. You MUST use write_and_run_js to write fresh code.\n</important_notice>`
                    : '');

            // 9. Build tools + apply force-stop + cache breakpoints
            const tools: Tool[] = forceStopReason
                ? []
                : shouldDisableEdit
                  ? [WRITE_AND_RUN_JS_TOOL]
                  : [WRITE_AND_RUN_JS_TOOL, EDIT_AND_RUN_JS_TOOL];

            if (forceStopReason) {
                applyForceStop(messages, forceStopReason);
            }

            const cachedMessages = markLastMessageForCaching(messages);

            // 10. Call Anthropic API
            // Cache processing order: tools → system → messages
            // 1h system breakpoint covers tools too (no tool breakpoint needed)
            // 5m message breakpoint caches conversation history prefix
            const response = await anthropic.createMessage({
                model: API_MODEL,
                system: buildCachedSystemPrompt(
                    stableSystemPrompt,
                    dynamicSystemPrompt,
                ),
                messages: cachedMessages,
                max_tokens: MAX_TOKENS,
                tools,
            });

            // 11. Process response
            const processedBlocks = await processResponseBlocks(
                response.content,
                lastCode,
                code,
            );

            // 12. Persist assistant turn
            await db
                .updateTable('conversations')
                .set({
                    last_turn_by: 'assistant',
                    last_message_at: new Date(),
                })
                .where('id', '=', conversationDBId)
                .execute();

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

            // 13. Return
            const outputBlocks = processedBlocks
                .map((p) => p.outputBlock)
                .filter((b): b is TAssistantBlock => b !== null);

            return {blocks: outputBlocks};
        }),
});

export type TConverseRouter = typeof converseRouter;
