import {observer} from '../lib/observe.js';

import {useChatWidget} from '../stores/chat-context.js';
import type {TDragHandleProps} from './draggable-panel.js';
import {MessageInput} from './message-input.js';
import {MessageList} from './message-list.js';
import {PanelHeader} from './panel-header.js';
import {tw} from '../lib/twind.js';

type TConversationPanelProps = {
    readonly title: string;
    readonly dragHandleProps: TDragHandleProps;
    readonly width: number;
    readonly height: number;
};

export const ConversationPanel = observer(
    ({title, dragHandleProps, width, height}: TConversationPanelProps) => {
        const {config} = useChatWidget();

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
                    <PanelHeader
                        title={title}
                        dragHandleProps={dragHandleProps}
                    />
                    <MessageList />
                    <MessageInput />
                    {config.disablePageUseBanner ? null : (
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
    },
);

