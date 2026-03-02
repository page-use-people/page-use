import {router} from '#core/trpc/trpc.mjs';
import {healthRouter} from '#core/trpc/routers/health.mjs';
import {conversationRouter} from '#core/trpc/routers/conversation.mjs';

export const appRouter = router({
    health: healthRouter,
    conversation: conversationRouter,
});

export type TAppRouter = typeof appRouter;
