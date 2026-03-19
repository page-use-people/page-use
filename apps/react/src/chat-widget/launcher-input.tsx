import {useEffect, useRef} from 'react';
import {observer} from './observe.js';

import {useChatWidget} from './chat-context.js';
import {tw} from './twind.js';

export const LauncherInput = observer(() => {
    const {session, ui, config} = useChatWidget();
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const isSubmitDisabled =
        session.isRunning || ui.composerText.trim().length === 0;

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

    const adjustTextareaHeight = () => {
        const textarea = textareaRef.current;
        if (!textarea) {
            return;
        }

        textarea.style.height = 'auto';
        textarea.style.height = `${textarea.scrollHeight}px`;
    };

    const handleSubmit = () => {
        if (session.submitMessage(ui.composerText)) {
            ui.clearComposerText();
            ui.expandPanel();
            const textarea = textareaRef.current;
            if (textarea) {
                textarea.style.height = 'auto';
            }
        }
    };

    const handleExpand = () => {
        const textarea = textareaRef.current;
        ui.expandPanel(
            ui.composerText,
            textarea?.selectionStart ?? ui.composerText.length,
            textarea?.selectionEnd ?? ui.composerText.length,
        );
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
                            handleSubmit();
                        }}
                        className={tw(
                            'grid grid-cols-[1fr_auto_auto] gap-2 items-end p-1',
                        )}>
                        <textarea
                            ref={textareaRef}
                            value={ui.composerText}
                            onChange={(event) => {
                                ui.updateComposerText(event.target.value);
                                adjustTextareaHeight();
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
                            rows={1}
                            disabled={session.isRunning}
                            className={tw(
                                'px-1 self-center resize-none w-full border-none outline-none bg-[color:var(--pu-bg)] text-[color:var(--pu-fg)] font-[inherit] text-sm leading-[1.5] max-h-[120px] overflow-hidden placeholder:text-[color:var(--pu-muted)]',
                            )}
                        />
                        <button
                            type="button"
                            onClick={handleExpand}
                            className={tw(
                                'border border-[color:var(--pu-muted)] py-1 px-2 cursor-pointer font-[inherit] text-sm rounded-[var(--pu-radius-sm)] bg-[color:var(--pu-surface)] text-[color:var(--pu-fg)]',
                            )}>
                            ↗
                        </button>
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
                    {config.disablePageUseBanner ? null : (
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
});

