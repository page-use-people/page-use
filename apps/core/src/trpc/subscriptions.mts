import {subscribeChannel} from '#core/redis/bridge.mjs';
import type {TEmitter, TEventMap} from '#core/events/types.mjs';
import type {Redis} from 'ioredis';

type TSubscribeToChannelOpts<TChannel extends keyof TEventMap> = {
    readonly redisSub: Redis;
    readonly emitter: TEmitter;
    readonly channel: TChannel;
    readonly signal: AbortSignal;
};

const subscribeToChannel = async function* <TChannel extends keyof TEventMap>(
    opts: TSubscribeToChannelOpts<TChannel>,
): AsyncGenerator<TEventMap[TChannel]> {
    const {redisSub, emitter, channel, signal} = opts;
    const unsubscribe = await subscribeChannel(redisSub, channel);

    try {
        const pending: Array<TEventMap[TChannel]> = [];
        const waiting: Array<(value: TEventMap[TChannel]) => void> = [];

        const handler = (payload: TEventMap[TChannel]) => {
            const resolve = waiting.shift();
            resolve ? resolve(payload) : pending.push(payload);
        };

        emitter.on(channel, handler);
        signal.addEventListener('abort', () => {
            emitter.off(channel, handler);
        });

        while (!signal.aborted) {
            const value =
                pending.shift() ??
                (await new Promise<TEventMap[TChannel]>((resolve) => {
                    waiting.push(resolve);
                }));

            yield value;
        }
    } finally {
        await unsubscribe();
    }
};

export {subscribeToChannel};
export type {TSubscribeToChannelOpts};
