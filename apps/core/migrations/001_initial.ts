import type {Kysely} from 'kysely';
import {sql} from 'kysely';

export const up = async (db: Kysely<unknown>): Promise<void> => {
    await db.schema
        .createTable('inference_calls')
        .addColumn('id', 'uuid', (col) => col.primaryKey())
        .addColumn('api', 'varchar(50)', (col) => col.notNull())
        .addColumn('model', 'varchar(100)', (col) => col.notNull())
        .addColumn('meta', 'jsonb')
        .addColumn('input_tokens', 'integer', (col) =>
            col.defaultTo(0).notNull(),
        )
        .addColumn('output_tokens', 'integer', (col) =>
            col.defaultTo(0).notNull(),
        )
        .addColumn('thinking_tokens', 'integer', (col) =>
            col.defaultTo(0).notNull(),
        )
        .addColumn('request', 'text', (col) => col.notNull())
        .addColumn('response', 'text', (col) => col.notNull())
        .addColumn('endpoint', 'varchar(255)', (col) => col.notNull())
        .addColumn('method', 'varchar(10)', (col) => col.notNull())
        .addColumn('created_at', 'timestamptz', (col) =>
            col.defaultTo(sql`now()`).notNull(),
        )
        .execute();

    await db.schema
        .createIndex('inference_calls_created_at_idx')
        .on('inference_calls')
        .column('created_at')
        .execute();
};

export const down = async (db: Kysely<unknown>): Promise<void> => {
    await db.schema.dropTable('inference_calls').execute();
};
