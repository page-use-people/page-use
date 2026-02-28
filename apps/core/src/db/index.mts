import {Kysely, PostgresDialect} from 'kysely';
import pg from 'pg';
import type {TDatabase} from '#core/db/types.mjs';
import {env} from '#core/env.mjs';

const createDialect = () =>
    new PostgresDialect({
        pool: new pg.Pool({
            connectionString: env.DATABASE_URL,
        }),
    });

export const db = new Kysely<TDatabase>({
    dialect: createDialect(),
});
