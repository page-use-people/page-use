import type {TRunHandle, TRunStatus, TRunUpdate} from '@page-use/client';

export type TChatRole = 'assistant' | 'user';

export type TChatMessage = {
    readonly id: string;
    readonly role: TChatRole;
    readonly content: string;
    readonly pending?: boolean;
};

export type TPageUseChatTheme = 'dark' | 'light';

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
};
