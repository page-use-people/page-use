import {useEffect, useRef} from 'react';
import {observer} from '../lib/observe.js';
import {reaction} from 'mobx';

import {useChatWidget} from '../stores/chat-context.js';
import {tw} from '../lib/twind.js';

export const MessageInput = observer(() => {
    const {session, ui, config} = useChatWidget();
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const isSubmitDisabled =
        session.isRunning || ui.composerText.trim().length === 0;

    useEffect(() => {
        const disposer = reaction(
            () => session.isRunning,
            (isRunning, wasRunning) => {
                if (wasRunning && !isRunning) {
                    const focusTimer = setTimeout(() => {
                        textareaRef.current?.focus();
                    }, 50);
                    return () => clearTimeout(focusTimer);
                }
            },
        );
        return disposer;
    }, [session]);

    useEffect(() => {
        const textarea = textareaRef.current;
        if (!textarea) {
            return;
        }

        textarea.focus();
        textarea.setSelectionRange(
            ui.composerSelectionStart,
            ui.composerSelectionEnd,
        );
    }, []);

    const handleSubmit = () => {
        if (session.submitMessage(ui.composerText)) {
            ui.clearComposerText();
        }
    };

    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                handleSubmit();
            }}
            className={tw(
                `border-t ${config.disablePageUseBanner ? '' : 'border-b'} border-[color:var(--pu-muted)] p-2 grid grid-cols-[1fr_auto] gap-3 items-end`,
            )}>
            <textarea
                ref={textareaRef}
                value={ui.composerText}
                onChange={(event) =>
                    ui.updateComposerText(event.target.value)
                }
                onSelect={(event) => {
                    const textarea = event.currentTarget;
                    ui.updateComposerSelection(
                        textarea.selectionStart,
                        textarea.selectionEnd,
                    );
                }}
                onKeyDown={(event) => {
                    if (
                        event.key === 'Enter' &&
                        !event.shiftKey &&
                        !event.ctrlKey &&
                        !event.metaKey
                    ) {
                        event.preventDefault();
                        handleSubmit();
                    }
                }}
                placeholder={config.placeholder}
                rows={3}
                autoFocus
                disabled={session.isRunning}
                className={tw(
                    'resize-none w-full border-none outline-none bg-[color:var(--pu-bg)] text-[color:var(--pu-fg)] font-[inherit] text-sm leading-[1.5] placeholder:text-[color:var(--pu-muted)]',
                )}
            />
            <button
                type="submit"
                disabled={isSubmitDisabled}
                className={tw(
                    `border border-[color:var(--pu-muted)] py-1 px-2 font-[inherit] text-sm rounded-[var(--pu-radius-sm)] ${
                        isSubmitDisabled
                            ? 'bg-[color:var(--pu-surface)] text-[color:var(--pu-muted)] cursor-not-allowed'
                            : 'bg-[color:var(--pu-fg)] text-[color:var(--pu-bg)] cursor-pointer'
                    }`,
                )}>
                SEND
            </button>
        </form>
    );
});

