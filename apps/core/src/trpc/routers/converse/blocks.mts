import type {ContentBlock} from '@anthropic-ai/sdk/resources/messages';
import type {TBlockType} from '#core/db/overrides.mjs';
import type {TSelectableBlock} from '#core/db/types.mjs';
import type {TUserBlock, TAssistantBlock} from './schemas.mjs';

// ── Block Type Mapping ──────────────────────────────────────

export const userBlockToDBType = (block: TUserBlock): TBlockType =>
    block.type === 'execution_result' ? 'tool_result' : 'text';

export const userBlockToPayload = (block: TUserBlock): unknown =>
    block.type === 'execution_result'
        ? {
              execution_identifier: block.execution_identifier,
              result: block.result,
              error: block.error,
          }
        : {message: block.message};

// ── Patch Failure Tracking ──────────────────────────────────

export const countConsecutiveEditFailures = (
    blocks: readonly TSelectableBlock[],
    currentBlocks: readonly TUserBlock[] = [],
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

    const orderedResults = [
        ...blocksByType.toolResult.map((block) => {
            const payload = block.payload as {
                execution_identifier: string;
                error: string | null;
            };

            return {
                execution_identifier: payload.execution_identifier,
                error: payload.error,
            };
        }),
        ...currentBlocks
            .filter(
                (block): block is Extract<TUserBlock, {type: 'execution_result'}> =>
                    block.type === 'execution_result',
            )
            .map((block) => ({
                execution_identifier: block.execution_identifier,
                error: block.error,
            })),
    ];

    // Walk backwards through tool_result blocks, including the current user turn.
    for (let i = orderedResults.length - 1; i >= 0; i--) {
        const resultBlock = orderedResults[i];
        if (!resultBlock.error) {
            break; // Success found, stop counting
        }

        const toolUseBlock = blocksByType.toolUse.get(
            resultBlock.execution_identifier,
        );
        if (!toolUseBlock) {
            break;
        }

        const toolPayload = toolUseBlock.payload as {tool_name: string};
        if (toolPayload.tool_name === 'edit_and_run_js') {
            count++;
        } else {
            break; // Non-patch tool found, stop counting
        }
    }

    return count;
};

// ── Response Processing ─────────────────────────────────────

type TCodeService = {
    readonly applyEdits: (original: string, edits: string) => string;
};

type TProcessedBlock = {
    readonly dbPayload: unknown;
    readonly dbType: TBlockType;
    readonly outputBlock: TAssistantBlock | null;
};

export const processResponseBlocks = async (
    content: readonly ContentBlock[],
    lastCode: string | null,
    codeService: TCodeService,
): Promise<readonly TProcessedBlock[]> =>
    Promise.all(
        content.map(async (block: ContentBlock): Promise<TProcessedBlock> => {
            if (block.type === 'tool_use') {
                const toolName = block.name;
                const input = block.input as {
                    js_code?: string;
                    edits?: string;
                    description?: string;
                };
                const description = input.description ?? toolName;

                let cleanCode: string;

                if (toolName === 'write_and_run_js') {
                    cleanCode = input.js_code ?? '';
                } else if (toolName === 'edit_and_run_js') {
                    if (!lastCode) {
                        cleanCode =
                            'throw new Error("No previous code to edit. Use write_and_run_js instead.");';
                    } else {
                        const edits = input.edits ?? '';
                        try {
                            cleanCode = codeService.applyEdits(lastCode, edits);
                        } catch (err) {
                            const message = err instanceof Error ? err.message : 'Unknown edit error';
                            cleanCode = `throw new Error(${JSON.stringify(message)});`;
                        }
                    }
                } else {
                    cleanCode =
                        `throw new Error("${toolName} is not a tool. It is a page function available inside your write_and_run_js code. Use write_and_run_js to call: await ${toolName}(...)");`;
                }

                return {
                    dbPayload: {
                        execution_identifier: block.id,
                        tool_name: toolName,
                        description,
                        code: cleanCode,
                    },
                    dbType: 'tool_use' as TBlockType,
                    outputBlock: {
                        type: 'execution' as const,
                        execution_identifier: block.id,
                        description,
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
