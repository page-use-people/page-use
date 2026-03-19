import {useEffect, useRef} from 'react';
import {observer} from './chat-widget/observe.js';
import {run} from '@page-use/client';

import {
    ChatWidgetProvider,
    useChatWidget,
    type TChatWidgetConfig,
} from './chat-widget/chat-context.js';
import {ConversationPanel} from './chat-widget/conversation-panel.js';
import {createSessionStore} from './chat-widget/create-session-store.js';
import {createUIStore} from './chat-widget/create-ui-store.js';
import {DraggablePanel} from './chat-widget/draggable-panel.js';
import {LauncherInput} from './chat-widget/launcher-input.js';
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

const themeToVars = (
    theme: TPageUseChatProps['theme'] = 'dark',
    roundedness: TPageUseChatProps['roundedness'] = 'none',
    overrides?: TPageUseChatProps['cssVariables'],
): Record<string, string> => {
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

const ChatWidgetBody = observer(
    ({
        title,
        width,
        height,
    }: {
        readonly title: string;
        readonly width: number;
        readonly height: number;
    }) => {
        const {ui} = useChatWidget();

        return ui.isPanelExpanded ? (
            <DraggablePanel width={width} height={height}>
                {({panelDragHandleProps}) => (
                    <ConversationPanel
                        title={title}
                        dragHandleProps={panelDragHandleProps}
                        width={width}
                        height={height}
                    />
                )}
            </DraggablePanel>
        ) : (
            <LauncherInput />
        );
    },
);

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

    const sessionRef = useRef<ReturnType<typeof createSessionStore> | null>(
        null,
    );
    if (!sessionRef.current) {
        sessionRef.current = createSessionStore({
            greeting,
            submitPrompt,
            devMode,
        });
    }

    const uiRef = useRef<ReturnType<typeof createUIStore> | null>(null);
    if (!uiRef.current) {
        uiRef.current = createUIStore({initiallyExpanded: initialOpen});
    }

    useEffect(() => {
        sessionRef.current?.store.updateSubmitPrompt(submitPrompt);
    }, [submitPrompt]);

    useEffect(() => () => sessionRef.current?.dispose(), []);

    const config: TChatWidgetConfig = {
        placeholder,
        suggestions: promptChips,
        devMode: devMode ?? false,
        disablePageUseBanner: disablePageUseBanner ?? false,
    };

    const contextValue = {
        session: sessionRef.current.store,
        ui: uiRef.current,
        config,
    };

    return (
        <ChatWidgetProvider value={contextValue}>
            <ShadowContainer cssVariables={vars} icon={icon}>
                <ChatWidgetBody
                    title={title}
                    width={width}
                    height={height}
                />
            </ShadowContainer>
        </ChatWidgetProvider>
    );
};
