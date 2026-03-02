import {router} from '#core/trpc/trpc.mjs';
import {healthRouter} from '#core/trpc/routers/health.mjs';
import {conversationRouter} from '#core/trpc/routers/conversation.mjs';
import {converseRouter} from '#core/trpc/routers/converse.mjs';

export const appRouter = router({
    health: healthRouter,
    conversation: conversationRouter,
    converse: converseRouter,
});

export type TAppRouter = typeof appRouter;
