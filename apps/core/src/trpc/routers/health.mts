import {router, publicProcedure} from '../trpc.mjs';

export const healthRouter = router({
    check: publicProcedure.query(() => ({
        status: 'ok' as const,
        timestamp: new Date().toISOString(),
    })),
});

export type THealthRouter = typeof healthRouter;
