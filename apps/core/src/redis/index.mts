import {Redis, type RedisOptions} from 'ioredis';
import {env} from '#core/env.mjs';

const createRedisClient = (
    connectionName?: string,
    options?: RedisOptions,
): Redis => new Redis(env.REDIS_URL, {connectionName, ...options});

const redis = createRedisClient('default');

export {redis, createRedisClient};
