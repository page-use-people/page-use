import crypto from 'node:crypto';
import Anthropic from '@anthropic-ai/sdk';
import type {
    MessageCreateParamsNonStreaming,
    Message,
} from '@anthropic-ai/sdk/resources/messages';
import type {Kysely} from 'kysely';
import {uuidv7} from 'uuidv7';
import type {TDatabase} from '#core/db/types.mjs';
import type {TCache} from '#core/cache/types.mjs';
import type {TRateLimiter} from '#core/services/rate-limiter.mjs';
import {logger} from '#core/logger.mjs';

const DEFAULT_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

type TAnthropicResponse = {
    readonly id: string;
    readonly model: string;
    readonly content: Message['content'];
    readonly usage: Message['usage'];
    readonly stop_reason: Message['stop_reason'];
};

type TAnthropicCreateParams = MessageCreateParamsNonStreaming;

type TAnthropic = {
    readonly createMessage: (
        params: TAnthropicCreateParams,
    ) => Promise<TAnthropicResponse>;
};

type TAnthropicDeps = {
    readonly apiKey: string;
    readonly cache: TCache;
    readonly db: Kysely<TDatabase>;
    readonly rateLimiter: TRateLimiter;
};

const createAnthropic = ({
    apiKey,
    cache,
    db,
    rateLimiter,
}: TAnthropicDeps): TAnthropic => {
    const client = new Anthropic({apiKey});

    return Object.freeze({
        createMessage: async (params) => {
            const hash = crypto
                .createHash('sha256')
                .update(JSON.stringify(params))
                .digest('hex');
            const cacheKey = `ANTHROPIC:${hash}`;

            return cache.cached(
                cacheKey,
                async () => {
                    // Rough token estimate: ~4 chars per token for input content
                    const inputText = JSON.stringify(params.messages);
                    const tokenEstimate = Math.ceil(inputText.length / 4);

                    const response = await rateLimiter.schedule(
                        params.model,
                        tokenEstimate,
                        () => client.messages.create(params),
                    );

                    const data: TAnthropicResponse = {
                        id: response.id,
                        model: response.model,
                        content: response.content,
                        usage: response.usage,
                        stop_reason: response.stop_reason,
                    };

                    db.insertInto('inference_calls')
                        .values({
                            id: uuidv7(),
                            api: 'anthropic',
                            model: response.model as string,
                            meta: null,
                            input_tokens: response.usage.input_tokens,
                            output_tokens: response.usage.output_tokens,
                            thinking_tokens: 0,
                            request: JSON.stringify(params),
                            response: JSON.stringify(data),
                            endpoint: 'messages',
                            method: 'POST',
                        })
                        .execute()
                        .catch((err) => {
                            logger.error('failed to log inference call', err);
                        });

                    return data;
                },
                {
                    expiryMs: DEFAULT_EXPIRY_MS,
                    isRealWorldExpensive: true,
                },
            );
        },
    });
};

export {createAnthropic};
export type {TAnthropic, TAnthropicCreateParams, TAnthropicResponse};
