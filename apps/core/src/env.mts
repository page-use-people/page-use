import {createEnv} from '@t3-oss/env-core';
import {z} from 'zod';

export const env = createEnv({
    server: {
        DATABASE_URL: z.url(),
        REDIS_URL: z.url(),
        CORE_PORT: z
            .string()
            .default('12001')
            .transform(Number)
            .pipe(z.number().int().positive()),
        NODE_ENV: z.enum(['development', 'production']).default('development'),
        ANTHROPIC_API_KEY: z.string(),
        JWT_SIGNING_KEY: z.string(),
        POSTHOG_API_KEY: z.string().optional(),
    },
    runtimeEnv: process.env,
    emptyStringAsUndefined: true,
});

export type TEnv = typeof env;
