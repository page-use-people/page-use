import {memo, useEffect, useMemo, useRef, useState} from 'react';

import {AUTO_SCROLL_THRESHOLD} from './shared.js';
import type {TDragHandleProps} from './floating-chat-shell.js';
import {parseMarkdown} from './markdown.js';
import type {TChatMessage, TPageUseChatPrompt} from './types.js';
import {tw} from './twind.js';

type TLauncherBarProps = {
    readonly placeholder: string;
    readonly isRunning: boolean;
    readonly onSubmit: (prompt: string) => boolean;
    readonly onMaximize: (
        draft: string,
        selectionStart: number,
        selectionEnd: number,
    ) => void;
    readonly disablePageUseBanner?: boolean;
    readonly initialValue?: string;
    readonly initialSelection?: readonly [number, number];
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
    readonly onClose: (
        text: string,
        selectionStart: number,
        selectionEnd: number,
    ) => void;
    readonly dragHandleProps: TDragHandleProps;
    readonly width: number;
    readonly height: number;
    readonly devMode?: boolean;
    readonly disablePageUseBanner?: boolean;
    readonly initialComposerValue?: string;
    readonly initialComposerSelection?: readonly [number, number];
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
    readonly disablePageUseBanner?: boolean;
    readonly initialValue?: string;
    readonly initialSelection?: readonly [number, number];
    readonly onTextChange?: (text: string) => void;
    readonly onSelectionChange?: (
        selectionStart: number,
        selectionEnd: number,
    ) => void;
};

type TChatHeaderProps = {
    readonly title: string;
    readonly onClose: () => void;
    readonly dragHandleProps: TDragHandleProps;
};

const DefaultIcon = () => <span className={tw('text-xl')}>🤖</span>;

const SPINNER_FRAMES = ['·', '✻', '✽', '✶', '✢'] as const;

const LOADING_PHRASES = Object.freeze([
    'doing agentic things',
    'agenting agentically',
    'agent go brrrr',
    'thinking like an agent',
    'thinking agentically',
    'putting agent hat on',
    'pondering agentically',
    'agentic pondering',
    'agent pondering',
    'doing agentic stuff',
    'agent beep booping',
    'agent-as-a-service-ing',
    'doing agent stuff',
    'doing agent things',
] as const);

const useSpinner = (running: boolean): string => {
    const [frame, setFrame] = useState(0);

    useEffect(() => {
        if (!running) {
            return;
        }

        const id = setInterval(
            () => setFrame((f) => (f + 1) % SPINNER_FRAMES.length),
            250,
        );
        return () => clearInterval(id);
    }, [running]);

    return SPINNER_FRAMES[frame] ?? '·';
};

const ChatMessageBubble = memo(
    ({message}: {readonly message: TChatMessage}) => {
        const isAssistant = message.role === 'assistant';

        return (
            <div
                className={tw(
                    `max-w-[88%] py-1 px-2 leading-[1.5] text-sm ${
                        isAssistant
                            ? 'self-start py-2 px-3 border border-[color:var(--pu-surface)] rounded-[var(--pu-radius-md)]'
                            : 'self-end whitespace-pre-wrap text-[color:var(--pu-fg)] bg-[color:var(--pu-surface)] rounded-[var(--pu-radius-md)]'
                    } ${message.pending ? 'opacity-90' : 'opacity-100'}`,
                )}>
                {isAssistant ? (
                    <div
                        className="pu-md"
                        dangerouslySetInnerHTML={{
                            __html: parseMarkdown(message.content),
                        }}
                    />
                ) : (
                    message.content
                )}
            </div>
        );
    },
);

ChatMessageBubble.displayName = 'ChatMessageBubble';

const ChatHeader = ({title, onClose, dragHandleProps}: TChatHeaderProps) => (
    <div
        {...dragHandleProps}
        className={tw(
            'flex items-center justify-between gap-3 py-2 px-2 border-b border-[color:var(--pu-muted)] cursor-grab text-sm select-none touch-none rounded-t-[var(--pu-radius-lg)]',
        )}>
        <div className={tw('flex items-center gap-2.5 min-w-0')}>
            <slot name="icon-panel">
                <DefaultIcon />
            </slot>
            <span>{title}</span>
        </div>
        <button
            type="button"
            onClick={onClose}
            onPointerDown={(event) => event.stopPropagation()}
            className={tw(
                'text-[color:var(--pu-muted)] py-1 px-2 cursor-pointer font-[inherit]',
            )}>
            ✕
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
    const loadingPhrase = useMemo(
        () =>
            LOADING_PHRASES[Math.floor(Math.random() * LOADING_PHRASES.length)],
        [isRunning],
    );
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
                'overflow-y-auto overscroll-contain p-2 flex flex-col gap-3 flex-1',
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
                                'self-start border border-[color:var(--pu-muted)] bg-[color:var(--pu-surface)] text-[color:var(--pu-fg)] py-1 px-2 cursor-pointer font-[inherit] text-sm text-left rounded-[var(--pu-radius-sm)]',
                            )}>
                            {chip.label}
                        </button>
                    ))}
                </div>
            ) : null}

            {isRunning || (devMode && loadingDetails.length > 0) ? (
                <div
                    className={tw(
                        'border-y border-[color:var(--pu-muted)] py-2 text-[color:var(--pu-fg)] italic text-xs flex flex-col gap-2',
                    )}>
                    <div className={tw(`flex flex-row gap-2`)}>
                        <div
                            className={tw(
                                'text-[color:var(--pu-accent)] w-5 text-center',
                            )}>
                            {spinner}
                        </div>{' '}
                        {loadingDetails.length > 0
                            ? loadingDetails[loadingDetails.length - 1]
                            : loadingPhrase}{' '}
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
    disablePageUseBanner = false,
    initialValue = '',
    initialSelection,
    onTextChange,
    onSelectionChange,
}: TChatComposerProps) => {
    const [inputValue, setInputValue] = useState(initialValue);
    const isSendDisabled = isRunning || inputValue.trim().length === 0;
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);

    useEffect(() => {
        if (!isRunning) {
            const id = setTimeout(() => {
                const el = textareaRef.current;
                if (!el) return;
                el.focus();
                if (initialSelection) {
                    el.setSelectionRange(
                        initialSelection[0],
                        initialSelection[1],
                    );
                }
            }, 50);
            return () => clearTimeout(id);
        }
    }, [isRunning]);

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
                `border-t ${disablePageUseBanner ? '' : 'border-b'} border-[color:var(--pu-muted)] p-2 grid grid-cols-[1fr_auto] gap-3 items-end`,
            )}>
            <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(event) => {
                    setInputValue(event.target.value);
                    onTextChange?.(event.target.value);
                }}
                onSelect={(event) => {
                    const el = event.currentTarget;
                    onSelectionChange?.(el.selectionStart, el.selectionEnd);
                }}
                onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        submitInput();
                    }
                }}
                placeholder={placeholder}
                rows={3}
                autoFocus
                disabled={isRunning}
                className={tw(
                    'resize-none w-full border-none outline-none bg-[color:var(--pu-bg)] text-[color:var(--pu-fg)] font-[inherit] text-sm leading-[1.5] placeholder:text-[color:var(--pu-muted)]',
                )}
            />
            <button
                type="submit"
                disabled={isSendDisabled}
                className={tw(
                    `border border-[color:var(--pu-muted)] py-1 px-2 font-[inherit] text-sm rounded-[var(--pu-radius-sm)] ${
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

export const LauncherBar = ({
    placeholder,
    isRunning,
    onSubmit,
    onMaximize,
    disablePageUseBanner = false,
    initialValue,
    initialSelection,
}: TLauncherBarProps) => {
    const [inputValue, setInputValue] = useState(initialValue ?? '');
    const isSendDisabled = isRunning || inputValue.trim().length === 0;
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);

    useEffect(() => {
        const el = textareaRef.current;
        if (!el || !initialSelection) return;
        el.focus();
        el.setSelectionRange(initialSelection[0], initialSelection[1]);
    }, []);

    const adjustHeight = () => {
        const textarea = textareaRef.current;
        if (!textarea) {
            return;
        }

        textarea.style.height = 'auto';
        textarea.style.height = `${textarea.scrollHeight}px`;
    };

    const submitInput = () => {
        if (onSubmit(inputValue)) {
            setInputValue('');
            const textarea = textareaRef.current;
            if (textarea) {
                textarea.style.height = 'auto';
            }
        }
    };

    return (
        <div
            className={tw(
                'fixed bottom-6 left-0 right-0 z-[2147483647] mx-auto w-full max-w-[400px] font-mono text-[color:var(--pu-fg)]',
            )}>
            <div
                className={tw(
                    'p-1.5 bg-[color:var(--pu-bg)] shadow-[var(--pu-shadow)] rounded-[calc(var(--pu-radius-lg)+3.5px)]',
                )}>
                <div
                    className={tw(
                        'border border-[color:var(--pu-muted)] rounded-[var(--pu-radius-lg)]',
                    )}>
                    <form
                        onSubmit={(event) => {
                            event.preventDefault();
                            submitInput();
                        }}
                        className={tw(
                            'grid grid-cols-[1fr_auto_auto] gap-2 items-end p-1',
                        )}>
                        <textarea
                            ref={textareaRef}
                            value={inputValue}
                            onChange={(event) => {
                                setInputValue(event.target.value);
                                adjustHeight();
                            }}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter' && !event.shiftKey) {
                                    event.preventDefault();
                                    submitInput();
                                }
                            }}
                            placeholder={placeholder}
                            rows={1}
                            disabled={isRunning}
                            className={tw(
                                'px-1 self-center resize-none w-full border-none outline-none bg-[color:var(--pu-bg)] text-[color:var(--pu-fg)] font-[inherit] text-sm leading-[1.5] max-h-[120px] overflow-hidden placeholder:text-[color:var(--pu-muted)]',
                            )}
                        />
                        <button
                            type="button"
                            onClick={() => {
                                const el = textareaRef.current;
                                onMaximize(
                                    inputValue,
                                    el?.selectionStart ?? inputValue.length,
                                    el?.selectionEnd ?? inputValue.length,
                                );
                            }}
                            className={tw(
                                'border border-[color:var(--pu-muted)] py-1 px-2 cursor-pointer font-[inherit] text-sm rounded-[var(--pu-radius-sm)] bg-[color:var(--pu-surface)] text-[color:var(--pu-fg)]',
                            )}>
                            ↗
                        </button>
                        <button
                            type="submit"
                            disabled={isSendDisabled}
                            className={tw(
                                `border border-[color:var(--pu-muted)] py-1 px-2 font-[inherit] text-sm rounded-[var(--pu-radius-sm)] ${
                                    isSendDisabled
                                        ? 'bg-[color:var(--pu-surface)] text-[color:var(--pu-muted)] cursor-not-allowed'
                                        : 'bg-[color:var(--pu-fg)] text-[color:var(--pu-bg)] cursor-pointer'
                                }`,
                            )}>
                            SEND
                        </button>
                    </form>
                    {disablePageUseBanner ? null : (
                        <div
                            className={tw(
                                'text-center text-[10px] text-[color:var(--pu-fg)] py-1.5 border-t border-[color:var(--pu-muted)]',
                            )}>
                            built with{' '}
                            <a
                                className={tw('font-bold')}
                                href={
                                    'https://github.com/page-use-people/page-use'
                                }>
                                {'<PageUse/>'}
                            </a>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

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
    disablePageUseBanner = false,
    initialComposerValue,
    initialComposerSelection,
}: TChatPanelProps) => {
    const composerTextRef = useRef(initialComposerValue ?? '');
    const composerSelectionRef = useRef<readonly [number, number]>(
        initialComposerSelection ?? [0, 0],
    );

    return (
        <div
            style={{width, height}}
            className={tw(
                'p-1.5 bg-[color:var(--pu-bg)] shadow-[var(--pu-shadow)] rounded-[calc(var(--pu-radius-lg)+3.5px)]',
            )}>
            <div
                className={tw(
                    'h-full flex flex-col border border-[color:var(--pu-muted)] rounded-[var(--pu-radius-lg)]',
                )}>
                <ChatHeader
                    title={title}
                    onClose={() =>
                        onClose(
                            composerTextRef.current,
                            composerSelectionRef.current[0],
                            composerSelectionRef.current[1],
                        )
                    }
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
                    disablePageUseBanner={disablePageUseBanner}
                    initialValue={initialComposerValue}
                    initialSelection={initialComposerSelection}
                    onTextChange={(text) => {
                        composerTextRef.current = text;
                    }}
                    onSelectionChange={(start, end) => {
                        composerSelectionRef.current = [start, end];
                    }}
                />
                {disablePageUseBanner ? null : (
                    <div
                        className={tw(
                            'text-center text-[10px] text-[color:var(--pu-fg)] py-1.5',
                        )}>
                        built with <strong>{'<PageUse/>'}</strong>
                    </div>
                )}
            </div>
        </div>
    );
};
