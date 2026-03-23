import {createTRPCClient, httpBatchLink} from '@trpc/client';
import type {TRPCClient} from '@trpc/client';
import type {TAppRouter} from '@page-use/core';

const DEFAULT_URL = 'http://localhost:12001/trpc' as const;

type TClientOptions = {
    readonly url?: string;
};

export type TClient = TRPCClient<TAppRouter>;

export const createClient = (options?: TClientOptions): TClient =>
    createTRPCClient<TAppRouter>({
        links: [
            httpBatchLink({
                url: options?.url ?? DEFAULT_URL,
            }),
        ],
    });
export type {TClientOptions};
