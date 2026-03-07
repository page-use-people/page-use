import {memo, useEffect, useRef, useState} from 'react';
import {
    run,
    type TRunHandle,
    type TRunStatus,
    type TRunUpdate,
} from '@page-use/client';

type TChatRole = 'assistant' | 'user';

type TChatMessage = {
    readonly id: string;
    readonly role: TChatRole;
    readonly content: string;
    readonly pending?: boolean;
};

export type TPageUseChatTheme = 'dark' | 'light';

export type TPageUseChatPrompt = {
    readonly label: string;
    readonly prompt: string;
};

export type TPageUseChatSubmitCallbacks = {
    readonly onMessage: (message: string) => void;
    readonly onUpdate: (update: TRunUpdate) => void;
    readonly onStatusChange: (status: TRunStatus) => void;
    readonly onError: (error: unknown) => void;
};

export type TPageUseChatProps = {
    readonly title?: string;
    readonly greeting?: string;
    readonly placeholder?: string;
    readonly promptChips?: readonly TPageUseChatPrompt[];
    readonly submitPrompt?: (
        prompt: string,
        callbacks: TPageUseChatSubmitCallbacks,
    ) => TRunHandle | Promise<TRunHandle>;
    readonly initialOpen?: boolean;
    readonly width?: number;
    readonly height?: number;
    readonly theme?: TPageUseChatTheme;
};

const PANEL_GAP = 24;
const BUBBLE_SIZE = 84;
const DEFAULT_WIDTH = 380;
const DEFAULT_HEIGHT = 560;
const AUTO_SCROLL_THRESHOLD = 40;

const DEFAULT_PROMPTS: readonly TPageUseChatPrompt[] = [
    {
        label: 'What can you do?',
        prompt: 'What are you capable of on this page?',
    },
];

const THEME_PALETTES = {
    dark: {
        background: '#000000',
        foreground: '#ffffff',
        surface: '#2e2e2e',
        muted: '#6d6d6d',
        divider: '#3d3d3d',
        accent: '#ff6a00',
    },
    light: {
        background: '#ffffff',
        foreground: '#000000',
        surface: '#e7e7e7',
        muted: '#6d6d6d',
        divider: '#c9c9c9',
        accent: '#ff6a00',
    },
} as const;

const clamp = (value: number, min: number, max: number) =>
    Math.min(Math.max(value, min), max);

const clampPosition = (
    x: number,
    y: number,
    width: number,
    height: number,
) => ({
    x: clamp(
        x,
        PANEL_GAP,
        Math.max(PANEL_GAP, window.innerWidth - width - PANEL_GAP),
    ),
    y: clamp(
        y,
        PANEL_GAP,
        Math.max(PANEL_GAP, window.innerHeight - height - PANEL_GAP),
    ),
});

const createId = () => crypto.randomUUID();

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

const PageUseLogo = memo(
    ({
        frameColor,
        accentColor,
        size,
    }: {
        readonly frameColor: string;
        readonly accentColor: string;
        readonly size: number;
    }) => (
        <svg
            aria-hidden="true"
            viewBox="0 0 64 64"
            width={size}
            height={size}
            fill="none">
            <path
                d="M18 6H39L50 17V54C50 56.2091 48.2091 58 46 58H18C15.7909 58 14 56.2091 14 54V10C14 7.79086 15.7909 6 18 6Z"
                stroke={frameColor}
                strokeWidth="3"
                strokeLinejoin="round"
            />
            <path
                d="M39 6V17H50"
                stroke={frameColor}
                strokeWidth="3"
                strokeLinejoin="round"
            />
            {[0, 45, 90, 135].map((rotation) => (
                <path
                    key={rotation}
                    d="M32 18C36.5 22 41.5 22.5 46 32C41.5 41.5 36.5 42 32 46C27.5 42 22.5 41.5 18 32C22.5 22.5 27.5 22 32 18Z"
                    stroke={accentColor}
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    transform={`rotate(${rotation} 32 32)`}
                />
            ))}
        </svg>
    ),
);

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
    const [isRunning, setIsRunning] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const [hasSubmittedPrompt, setHasSubmittedPrompt] = useState(false);
    const [loadingDetails, setLoadingDetails] = useState<string[]>([]);
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
    const [position, setPosition] = useState({x: PANEL_GAP, y: PANEL_GAP});

    const isMountedRef = useRef(true);
    const positionRef = useRef(position);
    const activeHandleRef = useRef<TRunHandle | null>(null);
    const activeAssistantMessageIdRef = useRef<string | null>(null);
    const dragOffsetRef = useRef<{x: number; y: number} | null>(null);
    const dragStartRef = useRef<{x: number; y: number} | null>(null);
    const dragFrameRef = useRef<number | null>(null);
    const queuedDragPositionRef = useRef(position);
    const isDraggingRef = useRef(false);
    const suppressLauncherClickRef = useRef(false);
    const scrollViewportRef = useRef<HTMLDivElement | null>(null);
    const scrollFrameRef = useRef<number | null>(null);
    const shouldStickToBottomRef = useRef(true);

    useEffect(() => {
        positionRef.current = position;
    }, [position]);

    useEffect(() => {
        const nextWidth = isOpen ? width : BUBBLE_SIZE;
        const nextHeight = isOpen ? height : BUBBLE_SIZE;

        setPosition((current) => {
            if (current.x !== PANEL_GAP || current.y !== PANEL_GAP) {
                return clampPosition(current.x, current.y, nextWidth, nextHeight);
            }

            return clampPosition(
                window.innerWidth - nextWidth - PANEL_GAP,
                window.innerHeight - nextHeight - PANEL_GAP,
                nextWidth,
                nextHeight,
            );
        });
    }, [height, isOpen, width]);

    useEffect(() => {
        const onPointerMove = (event: PointerEvent) => {
            if (!isDraggingRef.current || !dragOffsetRef.current) {
                return;
            }

            if (
                dragStartRef.current &&
                (Math.abs(event.clientX - dragStartRef.current.x) > 4 ||
                    Math.abs(event.clientY - dragStartRef.current.y) > 4)
            ) {
                suppressLauncherClickRef.current = true;
            }

            const boxWidth = isOpen ? width : BUBBLE_SIZE;
            const boxHeight = isOpen ? height : BUBBLE_SIZE;
            queuedDragPositionRef.current = clampPosition(
                event.clientX - dragOffsetRef.current.x,
                event.clientY - dragOffsetRef.current.y,
                boxWidth,
                boxHeight,
            );

            if (dragFrameRef.current !== null) {
                return;
            }

            dragFrameRef.current = window.requestAnimationFrame(() => {
                dragFrameRef.current = null;
                setPosition(queuedDragPositionRef.current);
            });
        };

        const onPointerUp = () => {
            isDraggingRef.current = false;
            dragOffsetRef.current = null;
            dragStartRef.current = null;
        };

        const onResize = () => {
            const boxWidth = isOpen ? width : BUBBLE_SIZE;
            const boxHeight = isOpen ? height : BUBBLE_SIZE;
            setPosition((current) =>
                clampPosition(current.x, current.y, boxWidth, boxHeight),
            );
        };

        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
        window.addEventListener('resize', onResize);

        return () => {
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
            window.removeEventListener('resize', onResize);
        };
    }, [height, isOpen, width]);

    useEffect(() => {
        return () => {
            isMountedRef.current = false;
            activeHandleRef.current?.abort();

            if (dragFrameRef.current !== null) {
                window.cancelAnimationFrame(dragFrameRef.current);
            }

            if (scrollFrameRef.current !== null) {
                window.cancelAnimationFrame(scrollFrameRef.current);
            }
        };
    }, []);

    const scheduleScrollToBottom = () => {
        if (scrollFrameRef.current !== null) {
            window.cancelAnimationFrame(scrollFrameRef.current);
        }

        scrollFrameRef.current = window.requestAnimationFrame(() => {
            scrollFrameRef.current = null;
            const viewport = scrollViewportRef.current;
            if (!viewport) {
                return;
            }

            viewport.scrollTop = viewport.scrollHeight;
        });
    };

    const syncScrollAnchor = () => {
        const viewport = scrollViewportRef.current;
        if (!viewport) {
            return;
        }

        const remainingDistance =
            viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
        shouldStickToBottomRef.current =
            remainingDistance <= AUTO_SCROLL_THRESHOLD;
    };

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        if (shouldStickToBottomRef.current || isRunning) {
            scheduleScrollToBottom();
        }
    }, [isOpen, isRunning, messages]);

    const startDrag = (clientX: number, clientY: number) => {
        isDraggingRef.current = true;
        suppressLauncherClickRef.current = false;
        dragOffsetRef.current = {
            x: clientX - positionRef.current.x,
            y: clientY - positionRef.current.y,
        };
        dragStartRef.current = {x: clientX, y: clientY};
    };

    const finalizeAssistantMessage = () => {
        if (!isMountedRef.current) {
            return;
        }

        const messageId = activeAssistantMessageIdRef.current;
        if (!messageId) {
            return;
        }

        setMessages((current) =>
            current.map((message) =>
                message.id === messageId
                    ? {...message, pending: false}
                    : message,
            ),
        );
        activeAssistantMessageIdRef.current = null;
    };

    const appendAssistantMessage = (content: string) => {
        if (!isMountedRef.current) {
            return;
        }

        setMessages((current) => {
            const activeMessageId = activeAssistantMessageIdRef.current;

            if (activeMessageId) {
                return current.map((message) =>
                    message.id === activeMessageId
                        ? {
                              ...message,
                              content: `${message.content}\n\n${content}`,
                          }
                        : message,
                );
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

        const content =
            error instanceof Error ? error.message : String(error);

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

        const detail =
            update.type === 'text'
                ? update.message
                : update.type === 'execution_start'
                  ? `running ${update.description}...`
                  : update.error
                    ? `${update.description} failed`
                    : `${update.description} completed`;

        setLoadingDetails((current) => [...current, detail]);
    };

    const handleStatusChange = (status: TRunStatus) => {
        if (!isMountedRef.current) {
            return;
        }

        if (status === 'running') {
            setIsRunning(true);
            return;
        }

        setIsRunning(false);
        setLoadingDetails([]);
        activeHandleRef.current = null;
        finalizeAssistantMessage();
    };

    const sendPrompt = async (rawPrompt?: string) => {
        const prompt = (rawPrompt ?? inputValue).trim();
        if (!prompt || isRunning) {
            return;
        }

        finalizeAssistantMessage();
        setIsOpen(true);
        setIsRunning(true);
        setHasSubmittedPrompt(true);
        setInputValue('');
        setLoadingDetails([]);
        setMessages((current) => [
            ...current,
            {
                id: createId(),
                role: 'user',
                content: prompt,
            },
        ]);
        shouldStickToBottomRef.current = true;

        try {
            const handle = await submitPrompt(prompt, {
                onMessage: appendAssistantMessage,
                onUpdate: appendLoadingDetail,
                onStatusChange: handleStatusChange,
                onError: appendErrorMessage,
            });

            activeHandleRef.current = handle;
            await handle.done;
        } catch (error) {
            if (!isMountedRef.current) {
                return;
            }

            setIsRunning(false);
            setLoadingDetails([]);
            activeHandleRef.current = null;
            finalizeAssistantMessage();
            appendErrorMessage(error);
        }
    };

    const showPromptChips =
        promptChips.length > 0 && !isRunning && !hasSubmittedPrompt;

    return (
        <div
            style={{
                position: 'fixed',
                left: position.x,
                top: position.y,
                zIndex: 2147483647,
                fontFamily:
                    '"IBM Plex Mono", "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
                color: palette.foreground,
                userSelect: isDraggingRef.current ? 'none' : 'auto',
            }}>
            {!isOpen ? (
                <button
                    type="button"
                    aria-label="Open Page Use chat"
                    onClick={() => {
                        if (suppressLauncherClickRef.current) {
                            suppressLauncherClickRef.current = false;
                            return;
                        }

                        setIsOpen(true);
                    }}
                    onPointerDown={(event) =>
                        startDrag(event.clientX, event.clientY)
                    }
                    style={{
                        width: BUBBLE_SIZE,
                        height: BUBBLE_SIZE,
                        border: `2px solid ${palette.foreground}`,
                        background: palette.background,
                        color: palette.foreground,
                        cursor: 'grab',
                        display: 'grid',
                        placeItems: 'center',
                        padding: 0,
                    }}>
                    <PageUseLogo
                        frameColor={palette.foreground}
                        accentColor={palette.accent}
                        size={52}
                    />
                </button>
            ) : (
                <div
                    style={{
                        width,
                        height,
                        display: 'grid',
                        gridTemplateRows: 'auto 1fr auto',
                        border: `2px solid ${palette.foreground}`,
                        background: palette.background,
                    }}>
                    <div
                        onPointerDown={(event) =>
                            startDrag(event.clientX, event.clientY)
                        }
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
                            onClick={() => setIsOpen(false)}
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

                    <div
                        ref={scrollViewportRef}
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
                            <div
                                key={message.id}
                                style={{
                                    alignSelf:
                                        message.role === 'user'
                                            ? 'flex-end'
                                            : 'flex-start',
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
                                        onClick={() => void sendPrompt(chip.prompt)}
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
                                            <div key={`${index}-${detail}`}>
                                                {detail}
                                            </div>
                                        ))}
                                    </div>
                                ) : null}
                            </div>
                        ) : null}
                    </div>

                    <form
                        onSubmit={(event) => {
                            event.preventDefault();
                            void sendPrompt();
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
                            onChange={(event) =>
                                setInputValue(event.target.value)
                            }
                            onKeyDown={(event) => {
                                if (event.key === 'Enter' && !event.shiftKey) {
                                    event.preventDefault();
                                    void sendPrompt();
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
                            disabled={
                                isRunning || inputValue.trim().length === 0
                            }
                            style={{
                                border: `2px solid ${palette.foreground}`,
                                background:
                                    isRunning || inputValue.trim().length === 0
                                        ? palette.surface
                                        : palette.foreground,
                                color:
                                    isRunning || inputValue.trim().length === 0
                                        ? palette.muted
                                        : palette.background,
                                padding: '10px 16px',
                                cursor:
                                    isRunning || inputValue.trim().length === 0
                                        ? 'not-allowed'
                                        : 'pointer',
                                font: 'inherit',
                                fontSize: 14,
                            }}>
                            SEND
                        </button>
                    </form>
                </div>
            )}
        </div>
    );
};
