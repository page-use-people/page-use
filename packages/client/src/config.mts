type TConfig = {
    readonly serverURL: string;
};

const DEFAULT_CONFIG: TConfig = Object.freeze({
    serverURL: 'http://localhost:12001/trpc',
});

let currentConfig: TConfig = DEFAULT_CONFIG;

export const configure = (options: Partial<TConfig>): void => {
    currentConfig = Object.freeze({...currentConfig, ...options});
};

export const getConfig = (): TConfig => currentConfig;

export type {TConfig};
