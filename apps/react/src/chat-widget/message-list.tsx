import {useEffect, useRef} from 'react';
import {observer} from './observe.js';
import {reaction} from 'mobx';

import {AUTO_SCROLL_THRESHOLD} from './shared.js';
import {useChatWidget} from './chat-context.js';
import {ExecutionStatus} from './execution-status.js';
import {MessageBubble} from './message-bubble.js';
import {SuggestionChips} from './suggestion-chips.js';
import {tw} from './twind.js';

export const MessageList = observer(() => {
    const {session} = useChatWidget();
    const viewportRef = useRef<HTMLDivElement | null>(null);
    const isNearBottomRef = useRef(true);

    useEffect(() => {
        const disposer = reaction(
            () => ({
                messageCount: session.messages.length,
                isRunning: session.isRunning,
                stepCount: session.executionSteps.length,
            }),
            () => {
                if (!isNearBottomRef.current && !session.isRunning) {
                    return;
                }

                const viewport = viewportRef.current;
                if (!viewport) {
                    return;
                }

                requestAnimationFrame(() => {
                    viewport.scrollTop = viewport.scrollHeight;
                });
            },
        );
        return disposer;
    }, [session]);

    const syncScrollAnchor = () => {
        const viewport = viewportRef.current;
        if (!viewport) {
            return;
        }

        const remainingDistance =
            viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
        isNearBottomRef.current = remainingDistance <= AUTO_SCROLL_THRESHOLD;
    };

    return (
        <div
            ref={viewportRef}
            onScroll={syncScrollAnchor}
            className={tw(
                'overflow-y-auto overscroll-contain p-2 flex flex-col gap-3 flex-1',
            )}>
            {session.messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
            ))}
            <SuggestionChips />
            <ExecutionStatus />
        </div>
    );
});

