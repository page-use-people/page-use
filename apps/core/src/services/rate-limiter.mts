import {default as BottleneckImport} from 'bottleneck';
import {Redis} from 'ioredis';
import {logger} from '#core/logger.mjs';

// Bottleneck lacks "type":"module" — same nodenext workaround as mitt
const Bottleneck = BottleneckImport as unknown as typeof BottleneckImport;

type TModelLimits = {
    readonly rpm: number;
    readonly rpd: number;
    readonly tpm: number;
    readonly maxConcurrent: number;
};

type TRateLimiter = {
    readonly schedule: <T>(
        model: string,
        tokenEstimate: number,
        fn: () => Promise<T>,
    ) => Promise<T>;
    readonly disconnect: () => Promise<void>;
};

const MODEL_LIMITS: Readonly<Record<string, TModelLimits>> = {
    'claude-sonnet-4-20250514': {
        rpm: 1_000,
        rpd: 10_000,
        tpm: 400_000,
        maxConcurrent: 50,
    },
    'claude-opus-4-20250514': {
        rpm: 200,
        rpd: 2_000,
        tpm: 100_000,
        maxConcurrent: 10,
    },
};

const DEFAULT_LIMITS: TModelLimits = {
    rpm: 10,
    rpd: 1000,
    tpm: 100_000,
    maxConcurrent: 2,
};

const getLimits = (model: string): TModelLimits =>
    MODEL_LIMITS[model] ?? DEFAULT_LIMITS;

type TLimiterTier = {
    readonly rpm: InstanceType<typeof Bottleneck>;
    readonly rpd: InstanceType<typeof Bottleneck>;
    readonly tpm: InstanceType<typeof Bottleneck>;
};

const createRateLimiter = (redisUrl: string): TRateLimiter => {
    const connection = new Bottleneck.IORedisConnection({
        clientOptions: redisUrl,
        clusterNodes: null,
        Redis,
    });

    connection.on('error', (err: Error) => {
        logger.error('[rate-limiter] redis connection error', err);
    });

    const limiters = new Map<string, TLimiterTier>();

    const getLimiterTier = (model: string): TLimiterTier => {
        const existing = limiters.get(model);
        if (existing) {
            return existing;
        }

        const limits = getLimits(model);

        const rpm = new Bottleneck({
            connection,
            id: `rl:rpm:${model}`,
            reservoir: limits.rpm,
            reservoirRefreshAmount: limits.rpm,
            reservoirRefreshInterval: 60_000,
            maxConcurrent: limits.maxConcurrent,
            minTime: Math.ceil(60_000 / limits.rpm),
        });
        rpm.on('error', (err: Error) => logger.error(`[rpm:${model}]`, err));
        rpm.on('depleted', () => logger.warn(`[rpm:${model}] RPM depleted`));
        rpm.on(
            'failed',
            async (
                error: Error & {status?: number; code?: number},
                jobInfo: {retryCount: number},
            ) => {
                if (jobInfo.retryCount >= 3) {
                    return undefined;
                }
                if (error?.status === 429 || error?.code === 429) {
                    const delay = Math.min(
                        60_000 * 2 ** jobInfo.retryCount,
                        300_000,
                    );
                    logger.warn(
                        `[rpm:${model}] 429 — retry ${jobInfo.retryCount + 1}/3 in ${delay / 1000}s`,
                    );
                    return delay;
                }
                return undefined;
            },
        );

        const rpd = new Bottleneck({
            connection,
            id: `rl:rpd:${model}`,
            reservoir: limits.rpd,
            reservoirRefreshAmount: limits.rpd,
            reservoirRefreshInterval: 24 * 60 * 60_000,
            maxConcurrent: limits.maxConcurrent,
        });
        rpd.on('error', (err: Error) => logger.error(`[rpd:${model}]`, err));
        rpd.on('depleted', () =>
            logger.warn(`[rpd:${model}] RPD depleted — daily quota exhausted`),
        );

        const tpm = new Bottleneck({
            connection,
            id: `rl:tpm:${model}`,
            reservoir: limits.tpm,
            reservoirRefreshAmount: limits.tpm,
            reservoirRefreshInterval: 60_000,
        });
        tpm.on('error', (err: Error) => logger.error(`[tpm:${model}]`, err));
        tpm.on('depleted', () => logger.warn(`[tpm:${model}] TPM depleted`));

        const tier: TLimiterTier = Object.freeze({rpm, rpd, tpm});
        limiters.set(model, tier);
        return tier;
    };

    // Gate order: RPD (most restrictive) -> TPM -> RPM (least restrictive)
    const schedule = <T,>(
        model: string,
        tokenEstimate: number,
        fn: () => Promise<T>,
    ): Promise<T> => {
        const tier = getLimiterTier(model);
        return tier.rpd.schedule(() =>
            tier.tpm.schedule({weight: tokenEstimate}, () =>
                tier.rpm.schedule(fn),
            ),
        );
    };

    const disconnect = async (): Promise<void> => {
        await connection.disconnect(false);
    };

    return Object.freeze({schedule, disconnect});
};

export {createRateLimiter};
export type {TRateLimiter, TModelLimits};
