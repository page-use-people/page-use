import {memo} from 'react';

import {parseMarkdown} from '../lib/markdown.js';
import type {TChatMessage} from '../types.js';
import {tw} from '../lib/twind.js';

const FallbackIcon = () => <span className={tw('text-xl')}>🤖</span>;

export {FallbackIcon};

/**
 * Renders a single chat message. Assistant messages are rendered as markdown
 * (sanitized by parseMarkdown which strips raw HTML and blocks javascript: URIs).
 * User messages are rendered as plain text.
 */
export const MessageBubble = memo(
    ({
        message,
        devMode,
    }: {
        readonly message: TChatMessage;
        readonly devMode: boolean;
    }) => {
        const isAssistant = message.role === 'assistant';
        const showDebugTrace =
            isAssistant &&
            devMode &&
            (message.debugTrace?.length ?? 0) > 0;

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
                    <div className={tw('flex flex-col gap-3')}>
                        <div
                            className="pu-md"
                            dangerouslySetInnerHTML={{
                                __html: parseMarkdown(message.content),
                            }}
                        />
                        {showDebugTrace ? (
                            <details
                                className={tw(
                                    'border-t border-[color:var(--pu-muted)] pt-2 text-xs',
                                )}>
                                <summary
                                    className={tw(
                                        'cursor-pointer select-none text-[color:var(--pu-fg)]/80',
                                    )}>
                                    Execution trace
                                </summary>
                                <div
                                    className={tw(
                                        'mt-2 flex flex-col gap-1 whitespace-pre-wrap font-mono text-[11px] leading-5 text-[color:var(--pu-fg)]/80',
                                    )}>
                                    {message.debugTrace?.map((step, stepIndex) => (
                                        <div key={`${stepIndex}-${step}`}>
                                            {step}
                                        </div>
                                    ))}
                                </div>
                            </details>
                        ) : null}
                    </div>
                ) : (
                    message.content
                )}
            </div>
        );
    },
);

MessageBubble.displayName = 'MessageBubble';
