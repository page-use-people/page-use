import {jwtVerify} from 'jose';
import {TRPCError} from '@trpc/server';
import {publicProcedure} from '../trpc.mjs';
import {env} from '#core/env.mjs';

const jwtSecret = new TextEncoder().encode(env.JWT_SIGNING_KEY);

export const procedureWithAuth = publicProcedure.use(async ({ctx, next}) => {
    if (!ctx.authToken) {
        return next({ctx: {userId: null}});
    }

    try {
        const {payload} = await jwtVerify(ctx.authToken, jwtSecret);
        const userId = (payload.user_id as string) ?? null;
        return next({ctx: {userId}});
    } catch {
        return next({ctx: {userId: null}});
    }
});

export const protectedProcedure = procedureWithAuth.use(async ({ctx, next}) => {
    if (!ctx.userId) {
        throw new TRPCError({code: 'UNAUTHORIZED'});
    }

    return next({ctx: {userId: ctx.userId}});
});
