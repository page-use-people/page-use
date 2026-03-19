import {createContext, useContext} from 'react';

import type {TSessionStore} from './create-session-store.js';
import type {TUIStore} from './create-ui-store.js';
import type {TPageUseChatPrompt} from './types.js';

export type TChatWidgetConfig = {
    readonly placeholder: string;
    readonly suggestions: readonly TPageUseChatPrompt[];
    readonly devMode: boolean;
    readonly disablePageUseBanner: boolean;
};

export type TChatWidgetContext = {
    readonly session: TSessionStore;
    readonly ui: TUIStore;
    readonly config: TChatWidgetConfig;
};

const ChatWidgetContext = createContext<TChatWidgetContext | null>(null);

export const ChatWidgetProvider = ChatWidgetContext.Provider;

export const useChatWidget = (): TChatWidgetContext => {
    const context = useContext(ChatWidgetContext);
    if (!context) {
        throw new Error('useChatWidget must be used within a ChatWidgetProvider');
    }
    return context;
};
