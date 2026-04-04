import {makeAutoObservable, runInAction} from 'mobx';
import type {TRunHandle, TRunStatus, TRunUpdate} from '@page-use/client';

import {createId} from '../lib/constants.js';
import type {TChatMessage, TPageUseChatSubmitCallbacks} from '../types.js';

type TSubmitPromptFn = (
    prompt: string,
    callbacks: TPageUseChatSubmitCallbacks,
) => TRunHandle | Promise<TRunHandle>;

type TSessionStoreConfig = {
    readonly greeting: string | undefined;
    readonly submitPrompt: TSubmitPromptFn;
    readonly devMode?: boolean;
};

export const createSessionStore = (config: TSessionStoreConfig) => {
    let activeHandle: TRunHandle | null = null;
    let activeAssistantMessageId: string | null = null;
    let disposed = false;
    let currentSubmitPrompt = config.submitPrompt;

    const attachDebugTraceToMessage = (
        messageId: string | null,
        debugTrace: readonly string[],
    ) => {
        if (!config.devMode || !messageId || debugTrace.length === 0) {
            return;
        }

        store.messages = store.messages.map((msg) =>
            msg.id === messageId && msg.role === 'assistant'
                ? {...msg, debugTrace}
                : msg,
        );
    };

    const consumePendingDebugTrace = (): readonly string[] => {
        const debugTrace = [...store.pendingDebugTrace];
        store.pendingDebugTrace = [];
        return debugTrace;
    };

    const clearActiveExecutionSteps = () => {
        store.activeExecutionSteps = [];
    };

    const finalizeAssistantMessage = () => {
        const messageId = activeAssistantMessageId;
        if (!messageId) {
            return;
        }

        activeAssistantMessageId = null;
        const lastMessage = store.messages[store.messages.length - 1];

        (lastMessage &&
            lastMessage.id === messageId &&
            lastMessage.role === 'assistant' &&
            lastMessage.pending)
            ? store.messages = store.messages.map((msg) =>
                msg.id === messageId ? {...msg, pending: false} : msg,
            )
            : undefined;
    };

    const appendAssistantContent = (content: string) => {
        if (disposed) {
            return;
        }

        const messageId = activeAssistantMessageId;
        const lastMessage = store.messages[store.messages.length - 1];

        if (
            messageId &&
            lastMessage &&
            lastMessage.id === messageId &&
            lastMessage.role === 'assistant'
        ) {
            store.messages = store.messages.map((msg) =>
                msg.id === messageId
                    ? {...msg, content: `${msg.content}\n\n${content}`}
                    : msg,
            );
            return;
        }

        const newId = createId();
        activeAssistantMessageId = newId;
        store.messages = [
            ...store.messages,
            {id: newId, role: 'assistant', content, pending: true},
        ];
    };

    const appendErrorMessage = (error: unknown) => {
        if (disposed) {
            return;
        }

        finalizeAssistantMessage();

        const content = error instanceof Error ? error.message : String(error);
        const debugTrace = consumePendingDebugTrace();
        store.messages = [
            ...store.messages,
            {
                id: createId(),
                role: 'assistant',
                content: `[error] ${content}`,
                debugTrace:
                    config.devMode && debugTrace.length > 0
                        ? debugTrace
                        : undefined,
            },
        ];
    };

    const handleUpdate = (update: TRunUpdate) => {
        if (disposed || update.type !== 'execution_start') {
            return;
        }

        store.activeExecutionSteps = [
            ...store.activeExecutionSteps,
            update.description,
        ];
        store.pendingDebugTrace = [
            ...store.pendingDebugTrace,
            update.description,
        ];
    };

    const handleStatusChange = (status: TRunStatus) => {
        if (disposed) {
            return;
        }

        if (status === 'running') {
            store.isRunning = true;
            return;
        }

        store.isRunning = false;
        clearActiveExecutionSteps();

        if (status === 'completed' || status === 'aborted') {
            attachDebugTraceToMessage(
                activeAssistantMessageId,
                consumePendingDebugTrace(),
            );
        }

        activeHandle = null;
        finalizeAssistantMessage();
    };

    const executePrompt = async (prompt: string) => {
        try {
            const handle = await currentSubmitPrompt(prompt, {
                onMessage: appendAssistantContent,
                onUpdate: handleUpdate,
                onStatusChange: handleStatusChange,
                onError: appendErrorMessage,
            });

            if (disposed) {
                handle.abort();
                return;
            }

            activeHandle = handle;
            await handle.done;
        } catch (error) {
            if (disposed) {
                return;
            }

            runInAction(() => {
                store.isRunning = false;
                clearActiveExecutionSteps();
                activeHandle = null;
                appendErrorMessage(error);
            });
        }
    };

    const store = makeAutoObservable({
        messages: (config.greeting
            ? [{id: createId(), role: 'assistant' as const, content: config.greeting}]
            : []) as readonly TChatMessage[],
        activeExecutionSteps: [] as readonly string[],
        pendingDebugTrace: [] as readonly string[],
        isRunning: false,
        hasInteracted: false,

        submitMessage(rawPrompt: string): boolean {
            const prompt = rawPrompt.trim();
            if (!prompt || this.isRunning) {
                return false;
            }

            finalizeAssistantMessage();
            this.isRunning = true;
            this.hasInteracted = true;
            this.activeExecutionSteps = [];
            this.pendingDebugTrace = [];
            this.messages = [
                ...this.messages,
                {id: createId(), role: 'user', content: prompt},
            ];

            void executePrompt(prompt);
            return true;
        },

        updateSubmitPrompt(fn: TSubmitPromptFn) {
            currentSubmitPrompt = fn;
        },
    });

    const dispose = () => {
        disposed = true;
        activeHandle?.abort();
    };

    return Object.freeze({store, dispose});
};

export type TSessionStore = ReturnType<typeof createSessionStore>['store'];
