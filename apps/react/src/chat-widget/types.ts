import type {ComponentType} from 'react';

import type {TRunHandle, TRunStatus, TRunUpdate} from '@page-use/client';

export type TChatRole = 'assistant' | 'user';

export type TChatMessage = {
    readonly id: string;
    readonly role: TChatRole;
    readonly content: string;
    readonly pending?: boolean;
};

export type TPageUseChatTheme = 'dark' | 'light';

export type TPageUseChatRoundedness = 'none' | 'sm' | 'md' | 'lg' | 'xl';

export type TPageUseCSSVariables = Partial<{
    '--pu-bg': string;
    '--pu-fg': string;
    '--pu-surface': string;
    '--pu-muted': string;
    '--pu-divider': string;
    '--pu-accent': string;
    '--pu-shadow': string;
    '--pu-radius-sm': string;
    '--pu-radius-md': string;
    '--pu-radius-lg': string;
}>;

export type TPageUseChatPrompt = {
    readonly label: string;
    readonly prompt: string;
};

export type TPageUseChatSubmitCallbacks = {
    readonly onMessage: (message: string) => void;
    readonly onUpdate: (update: TRunUpdate) => void;
    readonly onStatusChange: (status: TRunStatus) => void;
    readonly onError: (error: unknown) => void;
};

export type TPageUseChatProps = {
    readonly title?: string;
    readonly greeting?: string;
    readonly placeholder?: string;
    readonly promptChips?: readonly TPageUseChatPrompt[];
    readonly submitPrompt?: (
        prompt: string,
        callbacks: TPageUseChatSubmitCallbacks,
    ) => TRunHandle | Promise<TRunHandle>;
    readonly initialOpen?: boolean;
    readonly width?: number;
    readonly height?: number;
    readonly theme?: TPageUseChatTheme;
    readonly roundedness?: TPageUseChatRoundedness;
    readonly cssVariables?: TPageUseCSSVariables;
    readonly devMode?: boolean;
    readonly disablePageUseBanner?: boolean;
    readonly icon?: ComponentType<{readonly location: 'launcher' | 'panel'}>;
};
