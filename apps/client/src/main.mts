import {
    getActiveRunController,
    registerFunction,
    resetConversation,
    setActiveRunController,
    setContextInformation,
    setSystemPrompt,
    unregisterFunction,
    unsetContextInformation,
} from '#client/runtime-state.mjs';
import {runConversationLoop, isInvalidConversationHistoryError} from '#client/conversation-runner.mjs';
import type {TRunHandle, TRunOptions} from '#client/run-types.mjs';
import {setVariable, unsetVariable} from '#client/variable-observer.mjs';

export {
    registerFunction,
    resetConversation,
    setContextInformation,
    setSystemPrompt,
    unregisterFunction,
    unsetContextInformation,
    setVariable,
    unsetVariable,
};

export type {
    TRunHandle,
    TRunOptions,
    TRunStatus,
    TRunUpdate,
} from '#client/run-types.mjs';

export function run(userPrompt: string, options?: TRunOptions): TRunHandle {
    if (getActiveRunController() !== null) {
        throw new Error(
            'A Page Use response is already in progress. Wait for it to finish before sending another prompt.',
        );
    }

    const runAbortController = new AbortController();
    const runSignal = runAbortController.signal;
    setActiveRunController(runAbortController);
    options?.onStatusChange?.('running');

    const done = runConversationLoop({
        userPrompt,
        signal: runSignal,
        onMessage: options?.onMessage,
        onUpdate: options?.onUpdate,
    })
        .then(() => {
            options?.onStatusChange?.(
                runSignal.aborted ? 'aborted' : 'completed',
            );
        })
        .catch((error) => {
            if (runSignal.aborted) {
                options?.onStatusChange?.('aborted');
                return;
            }

            if (isInvalidConversationHistoryError(error)) {
                resetConversation();
            }

            console.error('run loop error:', error);
            options?.onError?.(error);
            options?.onStatusChange?.('error');
        })
        .finally(() => {
            if (getActiveRunController() === runAbortController) {
                setActiveRunController(null);
            }
        });

    return {
        abort: () => runAbortController.abort(),
        done,
    };
}
