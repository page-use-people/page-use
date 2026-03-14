import type {
    MessageParam,
    ToolResultBlockParam,
} from '@anthropic-ai/sdk/resources/messages';
import type {TSelectableBlock, TSelectableTurn} from '#core/db/types.mjs';
import type {TUserBlock} from './schemas.mjs';
import {MAX_AGENT_TURNS} from './schemas.mjs';

// ── User Content ────────────────────────────────────────────

export const buildUserContent = (
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

// ── Context Section ─────────────────────────────────────────

export const buildContextSection = (
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

// ── Message Sanitization ────────────────────────────────────

export const sanitizeMessages = (messages: MessageParam[]): MessageParam[] => {
    const toolResultIds = new Set<string>();

    messages.forEach((msg) => {
        if (!Array.isArray(msg.content)) {
            return;
        }
        (msg.content as ToolResultBlockParam[])
            .filter((b) => b.type === 'tool_result')
            .forEach((b) => toolResultIds.add(b.tool_use_id));
    });

    return messages.map((msg): MessageParam => {
        if (msg.role !== 'assistant' || !Array.isArray(msg.content)) {
            return msg;
        }

        return {
            ...msg,
            content: msg.content.filter(
                (b) => b.type !== 'tool_use' || toolResultIds.has(b.id),
            ),
        };
    });
};

// ── History Messages ────────────────────────────────────────

type TCodeService = {
    readonly formatWithLineNumbers: (code: string) => Promise<string>;
};

export const buildHistoryMessages = async (
    turns: readonly TSelectableTurn[],
    blocksByTurnId: Readonly<Record<string, readonly TSelectableBlock[]>>,
    codeService: TCodeService,
): Promise<MessageParam[]> =>
    Promise.all(
        turns.map(async (turn): Promise<MessageParam> => {
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
                            await codeService.formatWithLineNumbers(
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

// ── Force Stop ──────────────────────────────────────────────

export const applyForceStop = (messages: MessageParam[]): void => {
    const lastAssistantIdx = messages.findLastIndex(
        (m) => m.role === 'assistant',
    );
    if (lastAssistantIdx !== -1) {
        messages[lastAssistantIdx] = {
            role: 'assistant',
            content: [
                {
                    type: 'text',
                    text: 'I have used all of my available execution turns.',
                },
            ],
        };
    }

    const lastUserIdx = messages.length - 1;
    messages[lastUserIdx] = {
        role: 'user',
        content: [
            {
                type: 'text',
                text: `You have used all ${MAX_AGENT_TURNS} of your execution turns. Respond with ONLY a text message apologizing to the user. Briefly summarize what you accomplished and explain that you could not complete the request within the turn limit.`,
            },
        ],
    };
};
