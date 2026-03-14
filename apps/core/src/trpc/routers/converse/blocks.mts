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

export const countConsecutivePatchFailures = (
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
        (a, b) =>
            b.created_at.getTime() - a.created_at.getTime() ||
            b.id.localeCompare(a.id),
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

// ── Response Processing ─────────────────────────────────────

type TCodeService = {
    readonly formatWithLineNumbers: (code: string) => Promise<string>;
    readonly applyPatch: (original: string, patch: string) => string;
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
                    js_code_diff_patch?: string;
                };

                let cleanCode: string;

                if (toolName === 'write_and_run_js') {
                    cleanCode = input.js_code ?? '';
                } else if (toolName === 'patch_and_run_js') {
                    if (!lastCode) {
                        cleanCode =
                            'throw new Error("No previous code to patch. Use write_and_run_js instead.");';
                    } else {
                        const patch = input.js_code_diff_patch ?? '';
                        try {
                            cleanCode = codeService.applyPatch(lastCode, patch);
                        } catch {
                            cleanCode =
                                'throw new Error("Failed to apply patch. The diff was malformed. Use write_and_run_js to write fresh code instead.");';
                        }
                    }
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
