import type {Redis} from 'ioredis';
import type {TEmitter} from '#core/events/types.mjs';
import {logger} from '#core/logger.mjs';

const bridgeRedisToEmitter = (redisSub: Redis, emitter: TEmitter): void => {
    redisSub.on('message', (channel: string, message: string) => {
        logger.debug(`redis message on channel: ${channel}`);
        const parsed = JSON.parse(message);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (emitter as any).emit(channel, parsed);
    });
};

const subscribeChannel = async (
    redisSub: Redis,
    channel: string,
): Promise<() => Promise<void>> => {
    await redisSub.subscribe(channel);
    logger.debug(`subscribed to redis channel: ${channel}`);

    return async () => {
        await redisSub.unsubscribe(channel);
        logger.debug(`unsubscribed from redis channel: ${channel}`);
    };
};

export {bridgeRedisToEmitter, subscribeChannel};
