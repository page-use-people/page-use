// Abort-aware timing utilities for sandbox code execution. All functions
// respect AbortSignal so they clean up immediately when a run is cancelled.

// Promise-based setTimeout that rejects immediately if the signal is already
// aborted, and cleans up the timer + listener whichever fires first.
export const createAbortableTimeout = (
    signal: AbortSignal,
    ms: number,
): Promise<void> =>
    new Promise<void>((resolve, reject) => {
        signal.throwIfAborted();
        const id = setTimeout(() => {
            signal.removeEventListener('abort', onAbort);
            resolve();
        }, ms);
        const onAbort = () => {
            clearTimeout(id);
            reject(signal.reason);
        };
        signal.addEventListener('abort', onAbort, {once: true});
    });

// Pushes execution to the next macrotask (setTimeout 0) so that DOM updates
// and state changes from prior microtasks have settled before the function runs.
export const deferExecution = async <TValue,>(
    func: () => Promise<TValue>,
    signal: AbortSignal,
): Promise<TValue> => {
    await createAbortableTimeout(signal, 0);
    return await func();
};

export const createDelay = (signal: AbortSignal) => (ms: number) =>
    createAbortableTimeout(signal, ms);

// Two-tier abort: the child controller aborts if the parent does (user cancels
// the whole run) or if its own timeout fires (single execution took too long).
// cleanup() removes both the timeout and parent listener to prevent leaks.
export const createChildAbortController = (
    parentSignal: AbortSignal,
    timeoutMs: number,
): {signal: AbortSignal; cleanup: () => void} => {
    const controller = new AbortController();
    const timeoutId = setTimeout(
        () =>
            controller.abort(`execution timed out after ${timeoutMs / 1000}s`),
        timeoutMs,
    );
    const onParentAbort = () => controller.abort(parentSignal.reason);
    parentSignal.addEventListener('abort', onParentAbort, {once: true});

    return {
        signal: controller.signal,
        cleanup: () => {
            clearTimeout(timeoutId);
            parentSignal.removeEventListener('abort', onParentAbort);
        },
    };
};
