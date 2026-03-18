import {useState} from 'react';
import {run} from '@page-use/client';

import {LauncherBar, ChatPanel} from './chat-widget/chat-panel.js';
import {FloatingChatShell} from './chat-widget/floating-chat-shell.js';
import {ShadowContainer} from './chat-widget/shadow-container.js';
import {
    DEFAULT_HEIGHT,
    DEFAULT_WIDTH,
    ROUNDEDNESS_SCALES,
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
    TPageUseChatRoundedness,
    TPageUseChatSubmitCallbacks,
    TPageUseChatTheme,
    TPageUseCSSVariables,
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

const themeToVars = (theme: TPageUseChatProps['theme'] = 'dark', roundedness: TPageUseChatProps['roundedness'] = 'none', overrides?: TPageUseChatProps['cssVariables']): Record<string, string> => {
    const palette = THEME_PALETTES[theme ?? 'dark'];
    const radii = ROUNDEDNESS_SCALES[roundedness ?? 'none'];
    return {
        '--pu-bg': palette.background,
        '--pu-fg': palette.foreground,
        '--pu-surface': palette.surface,
        '--pu-muted': palette.muted,
        '--pu-divider': palette.divider,
        '--pu-accent': palette.accent,
        '--pu-shadow': palette.shadow,
        '--pu-radius-sm': radii.sm,
        '--pu-radius-md': radii.md,
        '--pu-radius-lg': radii.lg,
        ...overrides,
    };
};

export const PageUseChat = ({
    title = 'Agent',
    greeting,
    placeholder = '',
    promptChips = [],
    submitPrompt = defaultSubmitPrompt,
    initialOpen = false,
    width = DEFAULT_WIDTH,
    height = DEFAULT_HEIGHT,
    theme = 'dark',
    roundedness = 'none',
    cssVariables,
    devMode,
    disablePageUseBanner,
    icon,
}: TPageUseChatProps) => {
    const vars = themeToVars(theme, roundedness, cssVariables);
    const [isOpen, setIsOpen] = useState(initialOpen);
    const [launcherDraft, setLauncherDraft] = useState<{readonly text: string; readonly selectionStart: number; readonly selectionEnd: number} | null>(null);
    const {
        messages,
        loadingDetails,
        isRunning,
        hasSubmittedPrompt,
        sendPrompt,
    } = usePageUseChatSession({
        greeting,
        submitPrompt,
        devMode,
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
        <ShadowContainer cssVariables={vars} icon={icon}>
            {isOpen ? (
                <FloatingChatShell width={width} height={height}>
                    {({panelDragHandleProps}) => (
                        <ChatPanel
                            title={title}
                            placeholder={placeholder}
                            promptChips={promptChips}
                            showPromptChips={showPromptChips}
                            messages={messages}
                            loadingDetails={loadingDetails}
                            isRunning={isRunning}
                            onSendPrompt={handleSendPrompt}
                            onClose={(text, selectionStart, selectionEnd) => { setLauncherDraft({text, selectionStart, selectionEnd}); setIsOpen(false); }}
                            dragHandleProps={panelDragHandleProps}
                            width={width}
                            height={height}
                            devMode={devMode}
                            disablePageUseBanner={disablePageUseBanner}
                            initialComposerValue={launcherDraft?.text ?? ''}
                            initialComposerSelection={launcherDraft ? [launcherDraft.selectionStart, launcherDraft.selectionEnd] as const : undefined}
                        />
                    )}
                </FloatingChatShell>
            ) : (
                <LauncherBar
                    placeholder={placeholder}
                    isRunning={isRunning}
                    onSubmit={handleSendPrompt}
                    onMaximize={(draft, selectionStart, selectionEnd) => { setLauncherDraft({text: draft, selectionStart, selectionEnd}); setIsOpen(true); }}
                    initialValue={launcherDraft?.text ?? ''}
                    initialSelection={launcherDraft ? [launcherDraft.selectionStart, launcherDraft.selectionEnd] as const : undefined}
                    disablePageUseBanner={disablePageUseBanner}
                />
            )}
        </ShadowContainer>
    );
};
