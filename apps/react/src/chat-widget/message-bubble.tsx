import {memo} from 'react';

import {parseMarkdown} from './markdown.js';
import type {TChatMessage} from './types.js';
import {tw} from './twind.js';

const FallbackIcon = () => <span className={tw('text-xl')}>🤖</span>;

export {FallbackIcon};

/**
 * Renders a single chat message. Assistant messages are rendered as markdown
 * (sanitized by parseMarkdown which strips raw HTML and blocks javascript: URIs).
 * User messages are rendered as plain text.
 */
export const MessageBubble = memo(
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

MessageBubble.displayName = 'MessageBubble';
