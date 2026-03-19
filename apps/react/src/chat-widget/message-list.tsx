import {useEffect, useRef} from 'react';
import {observer} from './observe.js';
import {reaction} from 'mobx';

import {AUTO_SCROLL_THRESHOLD, SCROLL_SETTLE_MS} from './shared.js';
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
        let scrollTimer: ReturnType<typeof setTimeout> | null = null;

        const disposer = reaction(
            () => {
                const lastMessage =
                    session.messages[session.messages.length - 1];
                return {
                    messageCount: session.messages.length,
                    lastContentLength: lastMessage?.content.length ?? 0,
                    stepCount: session.executionSteps.length,
                };
            },
            () => {
                if (!isNearBottomRef.current && !session.isRunning) {
                    return;
                }

                const viewport = viewportRef.current;
                if (!viewport) {
                    return;
                }

                if (scrollTimer) {
                    clearTimeout(scrollTimer);
                }

                scrollTimer = setTimeout(() => {
                    viewport.scrollTop = viewport.scrollHeight;
                    scrollTimer = null;
                }, SCROLL_SETTLE_MS);
            },
        );

        return () => {
            disposer();
            if (scrollTimer) {
                clearTimeout(scrollTimer);
            }
        };
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

