type TCachedOptions = {
    readonly expiryMs?: number;
    readonly isRealWorldExpensive?: boolean;
};

type TCache = {
    readonly cached: <T>(
        key: string,
        fn: () => T | Promise<T>,
        options?: TCachedOptions,
    ) => Promise<T>;
};

export type {TCachedOptions};

export type {TCache};
