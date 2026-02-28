import type {Redis} from 'ioredis';
import type {TCache} from '#core/cache/types.mjs';

const createCache = (redis: Redis, isDev: boolean): TCache => {
    const cached: TCache['cached'] = async (key, fn, options) => {
        const {expiryMs, isRealWorldExpensive = false} = options ?? {};

        if (isDev && !isRealWorldExpensive) {
            return await fn();
        }

        const existing = await redis.get(key);

        if (existing !== null) {
            return JSON.parse(existing) as Awaited<ReturnType<typeof fn>>;
        }

        const result = await fn();
        const serialized = JSON.stringify(result);

        expiryMs !== undefined
            ? await redis.set(key, serialized, 'PX', expiryMs)
            : await redis.set(key, serialized);

        return result;
    };

    return Object.freeze({cached});
};

type TLocalEntry = {
    readonly value: string;
    readonly expiresAt: number | undefined;
};

const createLocalCache = (isDev: boolean): TCache => {
    const store = new Map<string, TLocalEntry>();

    const cached: TCache['cached'] = async (key, fn, options) => {
        const {expiryMs, isRealWorldExpensive = false} = options ?? {};

        if (isDev && !isRealWorldExpensive) {
            return await fn();
        }

        const entry = store.get(key);

        if (entry !== undefined) {
            const isExpired =
                entry.expiresAt !== undefined && Date.now() >= entry.expiresAt;

            if (!isExpired) {
                return JSON.parse(entry.value) as Awaited<
                    ReturnType<typeof fn>
                >;
            }

            store.delete(key);
        }

        const result = await fn();
        const serialized = JSON.stringify(result);

        store.set(key, {
            value: serialized,
            expiresAt:
                expiryMs !== undefined ? Date.now() + expiryMs : undefined,
        });

        return result;
    };

    return Object.freeze({cached});
};

export {createCache, createLocalCache};
export type {TCache, TCachedOptions} from '#core/cache/types.mjs';
