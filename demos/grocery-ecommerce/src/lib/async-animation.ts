import {wait} from './catalog.ts';

export const nextFrame = (signal?: AbortSignal) =>
    new Promise<void>((resolve, reject) => {
        if (signal?.aborted) {
            reject(
                signal.reason ?? new DOMException('Aborted', 'AbortError'),
            );
            return;
        }

        const onAbort = () => {
            window.cancelAnimationFrame(frame);
            reject(
                signal?.reason ?? new DOMException('Aborted', 'AbortError'),
            );
        };

        const frame = window.requestAnimationFrame(() => {
            signal?.removeEventListener('abort', onAbort);
            resolve();
        });

        signal?.addEventListener('abort', onAbort, {once: true});
    });

export const easeInOutCubic = (value: number) =>
    value < 0.5 ? 4 * value * value * value : 1 - (-2 * value + 2) ** 3 / 2;

export const waitForUi = async (signal?: AbortSignal, delay = 120) => {
    await nextFrame(signal);
    await wait(delay, signal);
    await nextFrame(signal);
};
