import {z} from 'zod';
import {router, publicProcedure} from '../trpc.mjs';

export const assistantBlockSchema = z.discriminatedUnion('type', [
    z.object({
        type: z.literal('execution'),
        execution_identifier: z.string(),
        description: z.string(),
        code: z.string(),
    }),
    z.object({
        type: z.literal('text'),
        message: z.string(),
    }),
    z.object({
        type: z.literal('thinking'),
        thinking: z.string(),
    }),
]);

export const userBlockSchema = z.discriminatedUnion('type', [
    z.object({
        type: z.literal('execution_result'),
        execution_identifier: z.string(),
        result: z.string(),
        error: z.string().nullable(),
    }),
    z.object({
        type: z.literal('text'),
        message: z.string(),
    }),
]);

const threadItemSchema = z.discriminatedUnion('actor', [
    z.object({
        timestamp: z.string(),
        actor: z.literal('assistant'),
        blocks: z.array(assistantBlockSchema),
    }),
    z.object({
        timestamp: z.string(),
        actor: z.literal('user'),
        blocks: z.array(userBlockSchema),
    }),
]);

const getConversationInputSchema = z.object({
    conversation_id: z.string(),
});

const getConversationOutputSchema = z.object({
    thread: z.array(threadItemSchema),
});

type TAssistantBlock = z.infer<typeof assistantBlockSchema>;
type TUserBlock = z.infer<typeof userBlockSchema>;

type TExecutionPayload = {
    readonly execution_identifier: string;
    readonly description: string;
    readonly code: string;
};

type TExecutionResultPayload = {
    readonly execution_identifier: string;
    readonly result: string;
    readonly error: string | null;
};

type TTextPayload = {
    readonly message: string;
};

type TThinkingPayload = {
    readonly thinking: string;
};

const mapAssistantBlock = (
    type: string,
    payload: unknown,
): TAssistantBlock | null => {
    const p = payload as Record<string, unknown>;
    return type === 'tool_use'
        ? {
              type: 'execution',
              execution_identifier: String(
                  (p as TExecutionPayload).execution_identifier ?? '',
              ),
              description: String((p as TExecutionPayload).description ?? ''),
              code: String((p as TExecutionPayload).code ?? ''),
          }
        : type === 'text'
          ? {
                type: 'text',
                message: String((p as TTextPayload).message ?? ''),
            }
          : type === 'thinking'
            ? {
                  type: 'thinking',
                  thinking: String((p as TThinkingPayload).thinking ?? ''),
              }
            : null;
};

const mapUserBlock = (type: string, payload: unknown): TUserBlock | null => {
    const p = payload as Record<string, unknown>;
    return type === 'tool_result'
        ? {
              type: 'execution_result',
              execution_identifier: String(
                  (p as TExecutionResultPayload).execution_identifier ?? '',
              ),
              result: String((p as TExecutionResultPayload).result ?? ''),
              error: (p as TExecutionResultPayload).error ?? null,
          }
        : type === 'text'
          ? {
                type: 'text',
                message: String((p as TTextPayload).message ?? ''),
            }
          : null;
};

export const conversationRouter = router({
    getConversation: publicProcedure
        .input(getConversationInputSchema)
        .output(getConversationOutputSchema)
        .query(async ({ctx, input}) => {
            const {db} = ctx.services;

            const turns = await db
                .selectFrom('turns')
                .selectAll()
                .where('conversation_id', '=', input.conversation_id)
                .orderBy('created_at', 'asc')
                .execute();

            if (turns.length === 0) {
                return {thread: []};
            }

            const turnIds = turns.map((t) => t.id);

            const blocks = await db
                .selectFrom('blocks')
                .selectAll()
                .where('turn_id', 'in', turnIds)
                .orderBy('created_at', 'asc')
                .execute();

            const blocksByTurnId = blocks.reduce<Record<string, typeof blocks>>(
                (acc, block) => {
                    const existing = acc[block.turn_id] ?? [];
                    return {...acc, [block.turn_id]: [...existing, block]};
                },
                {},
            );

            const thread = turns.map((turn) => {
                const turnBlocks = blocksByTurnId[turn.id] ?? [];
                const timestamp = turn.created_at.toISOString();

                return turn.actor === 'assistant'
                    ? {
                          timestamp,
                          actor: 'assistant' as const,
                          blocks: turnBlocks
                              .map((b) => mapAssistantBlock(b.type, b.payload))
                              .filter((b): b is TAssistantBlock => b !== null),
                      }
                    : {
                          timestamp,
                          actor: 'user' as const,
                          blocks: turnBlocks
                              .map((b) => mapUserBlock(b.type, b.payload))
                              .filter((b): b is TUserBlock => b !== null),
                      };
            });

            return {thread};
        }),
});

export type TConversationRouter = typeof conversationRouter;
