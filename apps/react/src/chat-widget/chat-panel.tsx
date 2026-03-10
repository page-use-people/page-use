import {memo, useEffect, useRef, useState} from 'react';

import {AUTO_SCROLL_THRESHOLD, PageUseLogo} from './shared.js';
import type {TDragHandleProps} from './floating-chat-shell.js';
import type {
    TChatMessage,
    TPageUseChatPrompt,
} from './types.js';
import type {TPageUseChatPalette} from './shared.js';

type TChatLauncherProps = {
    readonly palette: TPageUseChatPalette;
    readonly onOpen: () => void;
    readonly dragHandleProps: TDragHandleProps;
};

type TChatPanelProps = {
    readonly title: string;
    readonly placeholder: string;
    readonly promptChips: readonly TPageUseChatPrompt[];
    readonly showPromptChips: boolean;
    readonly messages: readonly TChatMessage[];
    readonly loadingDetails: readonly string[];
    readonly isRunning: boolean;
    readonly onSendPrompt: (prompt: string) => boolean;
    readonly onClose: () => void;
    readonly palette: TPageUseChatPalette;
    readonly dragHandleProps: TDragHandleProps;
    readonly width: number;
    readonly height: number;
};

type TChatTranscriptProps = {
    readonly messages: readonly TChatMessage[];
    readonly promptChips: readonly TPageUseChatPrompt[];
    readonly showPromptChips: boolean;
    readonly loadingDetails: readonly string[];
    readonly isRunning: boolean;
    readonly onSendPrompt: (prompt: string) => boolean;
    readonly palette: TPageUseChatPalette;
};

type TChatComposerProps = {
    readonly placeholder: string;
    readonly isRunning: boolean;
    readonly onSubmit: (prompt: string) => boolean;
    readonly palette: TPageUseChatPalette;
};

type TChatHeaderProps = {
    readonly title: string;
    readonly onClose: () => void;
    readonly palette: TPageUseChatPalette;
    readonly dragHandleProps: TDragHandleProps;
};

const ChatMessageBubble = memo(
    ({
        message,
        palette,
    }: {
        readonly message: TChatMessage;
        readonly palette: TPageUseChatPalette;
    }) => (
        <div
            style={{
                alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '88%',
                border: `2px solid ${
                    message.role === 'user'
                        ? palette.foreground
                        : palette.divider
                }`,
                background:
                    message.role === 'user'
                        ? palette.surface
                        : palette.background,
                padding: '12px 14px',
                whiteSpace: 'pre-wrap',
                lineHeight: 1.5,
                fontSize: 12,
                opacity: message.pending ? 0.9 : 1,
            }}>
            {message.content}
        </div>
    ),
);

ChatMessageBubble.displayName = 'ChatMessageBubble';

const ChatHeader = ({
    title,
    onClose,
    palette,
    dragHandleProps,
}: TChatHeaderProps) => (
    <div
        {...dragHandleProps}
        style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '12px 14px',
            borderBottom: `2px solid ${palette.foreground}`,
            cursor: 'grab',
            letterSpacing: '0.16em',
            fontSize: 14,
            userSelect: 'none',
            touchAction: 'none',
        }}>
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                minWidth: 0,
            }}>
            <PageUseLogo
                frameColor={palette.foreground}
                accentColor={palette.accent}
                size={28}
            />
            <span>{title}</span>
        </div>
        <button
            type="button"
            onClick={onClose}
            onPointerDown={(event) => event.stopPropagation()}
            style={{
                border: `2px solid ${palette.foreground}`,
                background: palette.surface,
                color: palette.foreground,
                padding: '4px 10px',
                cursor: 'pointer',
                font: 'inherit',
            }}>
            CLOSE
        </button>
    </div>
);

const ChatTranscript = ({
    messages,
    promptChips,
    showPromptChips,
    loadingDetails,
    isRunning,
    onSendPrompt,
    palette,
}: TChatTranscriptProps) => {
    const viewportRef = useRef<HTMLDivElement | null>(null);
    const frameRef = useRef<number | null>(null);
    const shouldStickToBottomRef = useRef(true);

    useEffect(() => {
        return () => {
            if (frameRef.current !== null) {
                window.cancelAnimationFrame(frameRef.current);
            }
        };
    }, []);

    const scheduleScrollToBottom = () => {
        if (frameRef.current !== null) {
            window.cancelAnimationFrame(frameRef.current);
        }

        frameRef.current = window.requestAnimationFrame(() => {
            frameRef.current = null;
            const viewport = viewportRef.current;
            if (!viewport) {
                return;
            }

            viewport.scrollTop = viewport.scrollHeight;
        });
    };

    const syncScrollAnchor = () => {
        const viewport = viewportRef.current;
        if (!viewport) {
            return;
        }

        const remainingDistance =
            viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
        shouldStickToBottomRef.current =
            remainingDistance <= AUTO_SCROLL_THRESHOLD;
    };

    useEffect(() => {
        if (shouldStickToBottomRef.current || isRunning) {
            scheduleScrollToBottom();
        }
    }, [isRunning, loadingDetails, messages, showPromptChips]);

    return (
        <div
            ref={viewportRef}
            onScroll={syncScrollAnchor}
            style={{
                overflowY: 'auto',
                overscrollBehavior: 'contain',
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
            }}>
            {messages.map((message) => (
                <ChatMessageBubble
                    key={message.id}
                    message={message}
                    palette={palette}
                />
            ))}

            {showPromptChips ? (
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                        marginTop: 4,
                    }}>
                    {promptChips.map((chip) => (
                        <button
                            key={chip.label}
                            type="button"
                            onClick={() => {
                                onSendPrompt(chip.prompt);
                            }}
                            style={{
                                alignSelf: 'flex-start',
                                border: `2px solid ${palette.divider}`,
                                background: palette.surface,
                                color: palette.foreground,
                                padding: '10px 14px',
                                cursor: 'pointer',
                                font: 'inherit',
                                fontSize: 12,
                                textAlign: 'left',
                            }}>
                            {chip.label}
                        </button>
                    ))}
                </div>
            ) : null}

            {isRunning ? (
                <div
                    style={{
                        borderTop: `2px solid ${palette.divider}`,
                        borderBottom: `2px solid ${palette.divider}`,
                        padding: '8px 0',
                        color: palette.muted,
                        fontStyle: 'italic',
                        fontSize: 12,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                    }}>
                    <div>* forming a response ...</div>
                    {loadingDetails.length > 0 ? (
                        <div
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 4,
                                fontStyle: 'normal',
                                whiteSpace: 'pre-wrap',
                            }}>
                            {loadingDetails.map((detail, index) => (
                                <div key={`${index}-${detail}`}>{detail}</div>
                            ))}
                        </div>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
};

const ChatComposer = ({
    placeholder,
    isRunning,
    onSubmit,
    palette,
}: TChatComposerProps) => {
    const [inputValue, setInputValue] = useState('');
    const isSendDisabled = isRunning || inputValue.trim().length === 0;

    const submitInput = () => {
        if (onSubmit(inputValue)) {
            setInputValue('');
        }
    };

    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                submitInput();
            }}
            style={{
                borderTop: `2px solid ${palette.foreground}`,
                padding: 12,
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                gap: 12,
                alignItems: 'end',
            }}>
            <textarea
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        submitInput();
                    }
                }}
                placeholder={placeholder}
                rows={3}
                disabled={isRunning}
                style={{
                    resize: 'none',
                    width: '100%',
                    border: 'none',
                    outline: 'none',
                    background: palette.background,
                    color: palette.foreground,
                    font: 'inherit',
                    fontSize: 16,
                    lineHeight: 1.5,
                }}
            />
            <button
                type="submit"
                disabled={isSendDisabled}
                style={{
                    border: `2px solid ${palette.foreground}`,
                    background: isSendDisabled
                        ? palette.surface
                        : palette.foreground,
                    color: isSendDisabled
                        ? palette.muted
                        : palette.background,
                    padding: '10px 16px',
                    cursor: isSendDisabled ? 'not-allowed' : 'pointer',
                    font: 'inherit',
                    fontSize: 14,
                }}>
                SEND
            </button>
        </form>
    );
};

export const ChatLauncher = ({
    palette,
    onOpen,
    dragHandleProps,
}: TChatLauncherProps) => (
    <button
        type="button"
        aria-label="Open Page Use chat"
        onClick={onOpen}
        {...dragHandleProps}
        style={{
            width: 84,
            height: 84,
            border: `2px solid ${palette.foreground}`,
            background: palette.background,
            color: palette.foreground,
            cursor: 'grab',
            display: 'grid',
            placeItems: 'center',
            padding: 0,
            userSelect: 'none',
            touchAction: 'none',
        }}>
        <PageUseLogo
            frameColor={palette.foreground}
            accentColor={palette.accent}
            size={52}
        />
    </button>
);

export const ChatPanel = ({
    title,
    placeholder,
    promptChips,
    showPromptChips,
    messages,
    loadingDetails,
    isRunning,
    onSendPrompt,
    onClose,
    palette,
    dragHandleProps,
    width,
    height,
}: TChatPanelProps) => (
    <div
        style={{
            width,
            height,
            display: 'grid',
            gridTemplateRows: 'auto 1fr auto',
            border: `2px solid ${palette.foreground}`,
            background: palette.background,
        }}>
        <ChatHeader
            title={title}
            onClose={onClose}
            palette={palette}
            dragHandleProps={dragHandleProps}
        />
        <ChatTranscript
            messages={messages}
            promptChips={promptChips}
            showPromptChips={showPromptChips}
            loadingDetails={loadingDetails}
            isRunning={isRunning}
            onSendPrompt={onSendPrompt}
            palette={palette}
        />
        <ChatComposer
            placeholder={placeholder}
            isRunning={isRunning}
            onSubmit={onSendPrompt}
            palette={palette}
        />
    </div>
);
