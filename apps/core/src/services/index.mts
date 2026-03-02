import {db} from '#core/db/index.mjs';
import {createRedisClient} from '#core/redis/index.mjs';
import {createEmitter} from '#core/events/index.mjs';
import {bridgeRedisToEmitter} from '#core/redis/bridge.mjs';
import {createAnthropic} from '#core/services/anthropic.mjs';
import {createRateLimiter} from '#core/services/rate-limiter.mjs';
import {createCache, createLocalCache} from '#core/cache/index.mjs';
import {createTelemetry} from '#core/services/telemetry.mjs';
import {createTemplateService} from '#core/services/template.mjs';
import {createCodeService} from '#core/services/code.mjs';
import {env} from '#core/env.mjs';
import type {TServices} from '#core/services/types.mjs';

const createServices = (): TServices => {
    const redisPub = createRedisClient('pub');
    const redisSub = createRedisClient('sub', {enableReadyCheck: false});
    const redisCache = createRedisClient('cache');
    const emitter = createEmitter();

    bridgeRedisToEmitter(redisSub, emitter);

    const isDev = env.NODE_ENV === 'development';
    const cache = createCache(redisCache, isDev);
    const rateLimiter = createRateLimiter(env.REDIS_URL);
    const anthropic = createAnthropic({
        apiKey: env.ANTHROPIC_API_KEY,
        cache,
        db,
        rateLimiter,
    });
    const localCache = createLocalCache(isDev);
    const telemetry = createTelemetry(env.POSTHOG_API_KEY);
    const template = createTemplateService();
    const code = createCodeService();

    return Object.freeze({
        db,
        redisPub,
        redisSub,
        emitter,
        anthropic,
        rateLimiter,
        cache,
        localCache,
        telemetry,
        template,
        code,
    });
};

export {createServices};
export type {TServices} from '#core/services/types.mjs';
