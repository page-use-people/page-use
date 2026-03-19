import {observer} from './observe.js';

import {useChatWidget} from './chat-context.js';
import type {TDragHandleProps} from './draggable-panel.js';
import {FallbackIcon} from './message-bubble.js';
import {tw} from './twind.js';

type TPanelHeaderProps = {
    readonly title: string;
    readonly dragHandleProps: TDragHandleProps;
};

export const PanelHeader = observer(
    ({title, dragHandleProps}: TPanelHeaderProps) => {
        const {ui} = useChatWidget();

        return (
            <div
                {...dragHandleProps}
                className={tw(
                    'flex items-center justify-between gap-3 py-2 px-2 border-b border-[color:var(--pu-muted)] cursor-grab text-sm select-none touch-none rounded-t-[var(--pu-radius-lg)]',
                )}>
                <div className={tw('flex items-center gap-2.5 min-w-0')}>
                    <slot name="icon-panel">
                        <FallbackIcon />
                    </slot>
                    <span>{title}</span>
                </div>
                <button
                    type="button"
                    onClick={() =>
                        ui.collapsePanel(
                            ui.composerText,
                            ui.composerSelectionStart,
                            ui.composerSelectionEnd,
                        )
                    }
                    onPointerDown={(event) => event.stopPropagation()}
                    className={tw(
                        'text-[color:var(--pu-muted)] py-1 px-2 cursor-pointer font-[inherit]',
                    )}>
                    ✕
                </button>
            </div>
        );
    },
);

