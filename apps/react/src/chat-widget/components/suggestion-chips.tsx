import {observer} from '../lib/observe.js';

import {useChatWidget} from '../stores/chat-context.js';
import {tw} from '../lib/twind.js';

export const SuggestionChips = observer(() => {
    const {session, config} = useChatWidget();

    const shouldShow =
        config.suggestions.length > 0 &&
        !session.isRunning &&
        !session.hasInteracted;

    return shouldShow ? (
        <div className={tw('flex flex-col gap-2 mt-1')}>
            {config.suggestions.map((suggestion) => (
                <button
                    key={suggestion.label}
                    type="button"
                    onClick={() => session.submitMessage(suggestion.prompt)}
                    className={tw(
                        'self-start border border-[color:var(--pu-muted)] bg-[color:var(--pu-surface)] text-[color:var(--pu-fg)] py-1 px-2 cursor-pointer font-[inherit] text-sm text-left rounded-[var(--pu-radius-sm)]',
                    )}>
                    {suggestion.label}
                </button>
            ))}
        </div>
    ) : null;
});

