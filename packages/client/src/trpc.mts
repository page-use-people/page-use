import {createTRPCClient, httpBatchLink} from '@trpc/client';
import type {TRPCClient} from '@trpc/client';
import type {TAppRouter} from '@page-use/core';
import {getConfig} from '#client/config.mjs';

type TClientOptions = {
    readonly url?: string;
};

export type TClient = TRPCClient<TAppRouter>;

export const createClient = (options?: TClientOptions): TClient =>
    createTRPCClient<TAppRouter>({
        links: [
            httpBatchLink({
                url: options?.url ?? getConfig().serverURL,
            }),
        ],
    });
export type {TClientOptions};
