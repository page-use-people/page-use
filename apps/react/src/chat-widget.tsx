import {useState} from 'react';
import {run} from '@page-use/client';

import {ChatLauncher, ChatPanel} from './chat-widget/chat-panel.js';
import {FloatingChatShell} from './chat-widget/floating-chat-shell.js';
import {
    DEFAULT_HEIGHT,
    DEFAULT_PROMPTS,
    DEFAULT_WIDTH,
    THEME_PALETTES,
} from './chat-widget/shared.js';
import type {
    TPageUseChatProps,
    TPageUseChatSubmitCallbacks,
} from './chat-widget/types.js';
import {usePageUseChatSession} from './chat-widget/use-page-use-chat-session.js';

export type {
    TPageUseChatPrompt,
    TPageUseChatProps,
    TPageUseChatSubmitCallbacks,
    TPageUseChatTheme,
} from './chat-widget/types.js';

const defaultSubmitPrompt = (
    prompt: string,
    callbacks: TPageUseChatSubmitCallbacks,
) =>
    run(prompt, {
        onMessage: callbacks.onMessage,
        onUpdate: callbacks.onUpdate,
        onStatusChange: callbacks.onStatusChange,
        onError: callbacks.onError,
    });

export const PageUseChat = ({
    title = 'PAGE USE',
    greeting = "Hello, I'm Page Use. I can inspect the current page state and call any functions you registered. How can I help?",
    placeholder = 'Ask Page Use something',
    promptChips = DEFAULT_PROMPTS,
    submitPrompt = defaultSubmitPrompt,
    initialOpen = false,
    width = DEFAULT_WIDTH,
    height = DEFAULT_HEIGHT,
    theme = 'dark',
}: TPageUseChatProps) => {
    const palette = THEME_PALETTES[theme];
    const [isOpen, setIsOpen] = useState(initialOpen);
    const {messages, loadingDetails, isRunning, hasSubmittedPrompt, sendPrompt} =
        usePageUseChatSession({
            greeting,
            submitPrompt,
        });

    const showPromptChips =
        promptChips.length > 0 && !isRunning && !hasSubmittedPrompt;

    const handleSendPrompt = (prompt: string) => {
        const didSend = sendPrompt(prompt);
        if (didSend && !isOpen) {
            setIsOpen(true);
        }

        return didSend;
    };

    return (
        <FloatingChatShell
            isOpen={isOpen}
            width={width}
            height={height}
            foregroundColor={palette.foreground}
            onOpen={() => setIsOpen(true)}>
            {({
                launcherDragHandleProps,
                panelDragHandleProps,
                onLauncherClick,
            }) =>
                isOpen ? (
                    <ChatPanel
                        title={title}
                        placeholder={placeholder}
                        promptChips={promptChips}
                        showPromptChips={showPromptChips}
                        messages={messages}
                        loadingDetails={loadingDetails}
                        isRunning={isRunning}
                        onSendPrompt={handleSendPrompt}
                        onClose={() => setIsOpen(false)}
                        palette={palette}
                        dragHandleProps={panelDragHandleProps}
                        width={width}
                        height={height}
                    />
                ) : (
                    <ChatLauncher
                        palette={palette}
                        onOpen={onLauncherClick}
                        dragHandleProps={launcherDragHandleProps}
                    />
                )
            }
        </FloatingChatShell>
    );
};
