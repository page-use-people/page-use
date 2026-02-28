import {initTRPC} from '@trpc/server';
import type {TContext} from '#core/trpc/context.mjs';

const t = initTRPC.context<TContext>().create({
    sse: {
        ping: {enabled: true, intervalMs: 3000},
    },
});

export const router = t.router;
export const publicProcedure = t.procedure;
