import {useEffect, useRef, useState} from 'react';
import type {TRunHandle, TRunStatus, TRunUpdate} from '@page-use/client';

import {createId, formatVariableWaitLabel} from './shared.js';
import type {
    TChatMessage,
    TPageUseChatSubmitCallbacks,
} from './types.js';

type TUsePageUseChatSessionOptions = {
    readonly greeting: string;
    readonly submitPrompt: (
        prompt: string,
        callbacks: TPageUseChatSubmitCallbacks,
    ) => TRunHandle | Promise<TRunHandle>;
};

export type TPageUseChatSession = {
    readonly messages: readonly TChatMessage[];
    readonly loadingDetails: readonly string[];
    readonly isRunning: boolean;
    readonly hasSubmittedPrompt: boolean;
    readonly sendPrompt: (prompt: string) => boolean;
};

const replaceLastMessage = (
    messages: readonly TChatMessage[],
    nextMessage: TChatMessage,
): TChatMessage[] => {
    const nextMessages = messages.slice();
    nextMessages[nextMessages.length - 1] = nextMessage;
    return nextMessages;
};

const formatLoadingDetail = (update: TRunUpdate): string => {
    switch (update.type) {
        case 'text':
            return update.message;
        case 'execution_start':
            return `running ${update.description}...`;
        case 'waiting_for_state':
            return update.variables.length === 0
                ? 'waiting for state update...'
                : `waiting for ${formatVariableWaitLabel(update.variables)} update${update.variables.length === 1 ? '' : 's'}...`;
        case 'state_update_observed':
            return `${update.variable} update observed`;
        case 'state_wait_timeout':
            return update.variables.length === 0
                ? 'state update timed out, continuing'
                : `${formatVariableWaitLabel(update.variables)} update${update.variables.length === 1 ? '' : 's'} timed out, continuing`;
        case 'execution_result':
            return update.error
                ? `${update.description} failed`
                : `${update.description} completed`;
    }
};

export const usePageUseChatSession = ({
    greeting,
    submitPrompt,
}: TUsePageUseChatSessionOptions): TPageUseChatSession => {
    const [messages, setMessages] = useState<TChatMessage[]>(
        greeting
            ? [
                  {
                      id: createId(),
                      role: 'assistant',
                      content: greeting,
                  },
              ]
            : [],
    );
    const [loadingDetails, setLoadingDetails] = useState<string[]>([]);
    const [isRunning, setIsRunning] = useState(false);
    const [hasSubmittedPrompt, setHasSubmittedPrompt] = useState(false);

    const isMountedRef = useRef(true);
    const isRunningRef = useRef(false);
    const submitPromptRef = useRef(submitPrompt);
    const activeHandleRef = useRef<TRunHandle | null>(null);
    const activeAssistantMessageIdRef = useRef<string | null>(null);

    useEffect(() => {
        submitPromptRef.current = submitPrompt;
    }, [submitPrompt]);

    useEffect(() => {
        return () => {
            isMountedRef.current = false;
            isRunningRef.current = false;
            activeHandleRef.current?.abort();
        };
    }, []);

    const finalizeAssistantMessage = () => {
        if (!isMountedRef.current) {
            return;
        }

        setMessages((current) => {
            const activeMessageId = activeAssistantMessageIdRef.current;
            const lastMessage = current[current.length - 1];

            if (
                !activeMessageId ||
                !lastMessage ||
                lastMessage.id !== activeMessageId ||
                lastMessage.role !== 'assistant' ||
                !lastMessage.pending
            ) {
                return current;
            }

            activeAssistantMessageIdRef.current = null;
            return replaceLastMessage(current, {
                ...lastMessage,
                pending: false,
            });
        });
    };

    const appendAssistantMessage = (content: string) => {
        if (!isMountedRef.current) {
            return;
        }

        setMessages((current) => {
            const activeMessageId = activeAssistantMessageIdRef.current;
            const lastMessage = current[current.length - 1];

            if (
                activeMessageId &&
                lastMessage &&
                lastMessage.id === activeMessageId &&
                lastMessage.role === 'assistant'
            ) {
                return replaceLastMessage(current, {
                    ...lastMessage,
                    content: `${lastMessage.content}\n\n${content}`,
                });
            }

            const nextMessage = {
                id: createId(),
                role: 'assistant' as const,
                content,
                pending: true,
            };

            activeAssistantMessageIdRef.current = nextMessage.id;
            return [...current, nextMessage];
        });
    };

    const appendErrorMessage = (error: unknown) => {
        if (!isMountedRef.current) {
            return;
        }

        finalizeAssistantMessage();

        const content = error instanceof Error ? error.message : String(error);

        setMessages((current) => [
            ...current,
            {
                id: createId(),
                role: 'assistant',
                content: `[error] ${content}`,
            },
        ]);
    };

    const appendLoadingDetail = (update: TRunUpdate) => {
        if (!isMountedRef.current) {
            return;
        }

        setLoadingDetails((current) => [...current, formatLoadingDetail(update)]);
    };

    const handleStatusChange = (status: TRunStatus) => {
        if (!isMountedRef.current) {
            return;
        }

        if (status === 'running') {
            isRunningRef.current = true;
            setIsRunning(true);
            return;
        }

        isRunningRef.current = false;
        setIsRunning(false);
        setLoadingDetails([]);
        activeHandleRef.current = null;
        finalizeAssistantMessage();
    };

    const sendPrompt = (rawPrompt: string) => {
        const prompt = rawPrompt.trim();
        if (!prompt || isRunningRef.current) {
            return false;
        }

        finalizeAssistantMessage();
        isRunningRef.current = true;
        setIsRunning(true);
        setHasSubmittedPrompt(true);
        setLoadingDetails([]);
        setMessages((current) => [
            ...current,
            {
                id: createId(),
                role: 'user',
                content: prompt,
            },
        ]);

        void (async () => {
            try {
                const handle = await submitPromptRef.current(prompt, {
                    onMessage: appendAssistantMessage,
                    onUpdate: appendLoadingDetail,
                    onStatusChange: handleStatusChange,
                    onError: appendErrorMessage,
                });

                if (!isMountedRef.current) {
                    handle.abort();
                    return;
                }

                activeHandleRef.current = handle;
                await handle.done;
            } catch (error) {
                if (!isMountedRef.current) {
                    return;
                }

                isRunningRef.current = false;
                setIsRunning(false);
                setLoadingDetails([]);
                activeHandleRef.current = null;
                finalizeAssistantMessage();
                appendErrorMessage(error);
            }
        })();

        return true;
    };

    return {
        messages,
        loadingDetails,
        isRunning,
        hasSubmittedPrompt,
        sendPrompt,
    };
};
