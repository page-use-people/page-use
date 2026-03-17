import {memo, useEffect, useRef, useState} from 'react';

import {AUTO_SCROLL_THRESHOLD, PageUseLogo} from './shared.js';
import type {TDragHandleProps} from './floating-chat-shell.js';
import type {TChatMessage, TPageUseChatPrompt} from './types.js';
import {tw} from './twind.js';

type TChatLauncherProps = {
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
    readonly dragHandleProps: TDragHandleProps;
    readonly width: number;
    readonly height: number;
    readonly devMode?: boolean;
};

type TChatTranscriptProps = {
    readonly messages: readonly TChatMessage[];
    readonly promptChips: readonly TPageUseChatPrompt[];
    readonly showPromptChips: boolean;
    readonly loadingDetails: readonly string[];
    readonly isRunning: boolean;
    readonly onSendPrompt: (prompt: string) => boolean;
    readonly devMode?: boolean;
};

type TChatComposerProps = {
    readonly placeholder: string;
    readonly isRunning: boolean;
    readonly onSubmit: (prompt: string) => boolean;
};

type TChatHeaderProps = {
    readonly title: string;
    readonly onClose: () => void;
    readonly dragHandleProps: TDragHandleProps;
};

const SPINNER_FRAMES = [
    '⠋',
    '⠙',
    '⠹',
    '⠸',
    '⠼',
    '⠴',
    '⠦',
    '⠧',
    '⠇',
    '⠏',
] as const;

const useSpinner = (running: boolean): string => {
    const [frame, setFrame] = useState(0);

    useEffect(() => {
        if (!running) {
            return;
        }

        const id = setInterval(
            () => setFrame((f) => (f + 1) % SPINNER_FRAMES.length),
            80,
        );
        return () => clearInterval(id);
    }, [running]);

    return SPINNER_FRAMES[frame] ?? '⠋';
};

const ChatMessageBubble = memo(
    ({message}: {readonly message: TChatMessage}) => (
        <div
            className={tw(
                `max-w-[88%] border-2 border-solid py-3 px-3.5 whitespace-pre-wrap leading-[1.5] text-xs ${
                    message.role === 'user'
                        ? 'self-end border-[color:var(--pu-fg)] bg-[color:var(--pu-surface)]'
                        : 'self-start border-[color:var(--pu-divider)] bg-[color:var(--pu-bg)]'
                } ${message.pending ? 'opacity-90' : 'opacity-100'}`,
            )}>
            {message.content}
        </div>
    ),
);

ChatMessageBubble.displayName = 'ChatMessageBubble';

const ChatHeader = ({title, onClose, dragHandleProps}: TChatHeaderProps) => (
    <div
        {...dragHandleProps}
        className={tw(
            'flex items-center justify-between gap-3 py-3 px-3.5 border-b-2 border-[color:var(--pu-fg)] cursor-grab tracking-[0.16em] text-sm select-none touch-none',
        )}>
        <div className={tw('flex items-center gap-2.5 min-w-0')}>
            <PageUseLogo
                frameColor="var(--pu-fg)"
                accentColor="var(--pu-accent)"
                size={28}
            />
            <span>{title}</span>
        </div>
        <button
            type="button"
            onClick={onClose}
            onPointerDown={(event) => event.stopPropagation()}
            className={tw(
                'border-2 border-[color:var(--pu-fg)] bg-[color:var(--pu-surface)] text-[color:var(--pu-fg)] py-1 px-2.5 cursor-pointer font-[inherit]',
            )}>
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
    devMode,
}: TChatTranscriptProps) => {
    const spinner = useSpinner(isRunning);
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
            className={tw(
                'overflow-y-auto overscroll-contain p-4 flex flex-col gap-3',
            )}>
            {messages.map((message) => (
                <ChatMessageBubble key={message.id} message={message} />
            ))}

            {showPromptChips ? (
                <div className={tw('flex flex-col gap-2 mt-1')}>
                    {promptChips.map((chip) => (
                        <button
                            key={chip.label}
                            type="button"
                            onClick={() => {
                                onSendPrompt(chip.prompt);
                            }}
                            className={tw(
                                'self-start border-2 border-[color:var(--pu-divider)] bg-[color:var(--pu-surface)] text-[color:var(--pu-fg)] py-2.5 px-3.5 cursor-pointer font-[inherit] text-xs text-left',
                            )}>
                            {chip.label}
                        </button>
                    ))}
                </div>
            ) : null}

            {isRunning || (devMode && loadingDetails.length > 0) ? (
                <div
                    className={tw(
                        'border-y-2 border-[color:var(--pu-divider)] py-2 text-[color:var(--pu-muted)] italic text-xs flex flex-col gap-2',
                    )}>
                    <div>
                        {spinner}{' '}
                        {loadingDetails.length > 0
                            ? loadingDetails[loadingDetails.length - 1]
                            : 'forming a response'}{' '}
                        ...
                    </div>
                    {devMode && loadingDetails.length > 0 ? (
                        <div
                            className={tw(
                                'flex flex-col gap-1 not-italic whitespace-pre-wrap',
                            )}>
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
            className={tw(
                'border-t-2 border-[color:var(--pu-fg)] p-3 grid grid-cols-[1fr_auto] gap-3 items-end',
            )}>
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
                className={tw(
                    'resize-none w-full border-none outline-none bg-[color:var(--pu-bg)] text-[color:var(--pu-fg)] font-[inherit] text-base leading-[1.5]',
                )}
            />
            <button
                type="submit"
                disabled={isSendDisabled}
                className={tw(
                    `border-2 border-[color:var(--pu-fg)] py-2.5 px-4 font-[inherit] text-sm ${
                        isSendDisabled
                            ? 'bg-[color:var(--pu-surface)] text-[color:var(--pu-muted)] cursor-not-allowed'
                            : 'bg-[color:var(--pu-fg)] text-[color:var(--pu-bg)] cursor-pointer'
                    }`,
                )}>
                SEND
            </button>
        </form>
    );
};

export const ChatLauncher = ({
    onOpen,
    dragHandleProps,
}: TChatLauncherProps) => (
    <button
        type="button"
        aria-label="Open Page Use chat"
        onClick={onOpen}
        {...dragHandleProps}
        className={tw(
            'w-[84px] h-[84px] border-4 border-black bg-[color:var(--pu-bg)] text-[color:var(--pu-fg)] cursor-grab grid place-items-center p-0 select-none touch-none',
        )}>
        <PageUseLogo
            frameColor="var(--pu-fg)"
            accentColor="var(--pu-accent)"
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
    dragHandleProps,
    width,
    height,
    devMode,
}: TChatPanelProps) => (
    <div
        className={tw(
            'grid grid-rows-[auto_1fr_auto] border-2 border-[color:var(--pu-fg)] bg-[color:var(--pu-bg)]',
        )}
        style={{width, height}}>
        <ChatHeader
            title={title}
            onClose={onClose}
            dragHandleProps={dragHandleProps}
        />
        <ChatTranscript
            messages={messages}
            promptChips={promptChips}
            showPromptChips={showPromptChips}
            loadingDetails={loadingDetails}
            isRunning={isRunning}
            onSendPrompt={onSendPrompt}
            devMode={devMode}
        />
        <ChatComposer
            placeholder={placeholder}
            isRunning={isRunning}
            onSubmit={onSendPrompt}
        />
    </div>
);
