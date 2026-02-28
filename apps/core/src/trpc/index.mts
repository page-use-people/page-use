import {router} from '#core/trpc/trpc.mjs';
import {healthRouter} from '#core/trpc/routers/health.mjs';

export const appRouter = router({
    health: healthRouter,
});

export type TAppRouter = typeof appRouter;
