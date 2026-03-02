import type {Kysely} from 'kysely';
import type {Redis} from 'ioredis';
import type {TDatabase} from '#core/db/types.mjs';
import type {TEmitter} from '#core/events/types.mjs';
import type {TAnthropic} from '#core/services/anthropic.mjs';
import type {TRateLimiter} from '#core/services/rate-limiter.mjs';
import type {TTelemetry} from '#core/services/telemetry.mjs';
import type {TCache} from '#core/cache/types.mjs';
import type {TTemplateService} from '#core/services/template.mjs';
import type {TCodeService} from '#core/services/code.mjs';

type TServices = {
    readonly db: Kysely<TDatabase>;
    readonly redisPub: Redis;
    readonly redisSub: Redis;
    readonly emitter: TEmitter;
    readonly anthropic: TAnthropic;
    readonly rateLimiter: TRateLimiter;
    readonly cache: TCache;
    readonly localCache: TCache;
    readonly telemetry: TTelemetry;
    readonly template: TTemplateService;
    readonly code: TCodeService;
};

export type {TServices};
