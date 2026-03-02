import type {Kysely} from 'kysely';
import {sql} from 'kysely';

const isDev = process.env.NODE_ENV === 'dev';

export const up = async (db: Kysely<unknown>): Promise<void> => {
    await db.schema
        .createTable('blocks')
        .addColumn('id', 'uuid', (col) => col.primaryKey())
        .addColumn('conversation_id', 'uuid', (col) =>
            isDev
                ? col
                      .notNull()
                      .references('conversations.id')
                      .onDelete('cascade')
                : col.notNull(),
        )
        .addColumn('turn_id', 'uuid', (col) =>
            isDev
                ? col.notNull().references('turns.id').onDelete('cascade')
                : col.notNull(),
        )
        .addColumn('type', 'varchar(30)', (col) => col.notNull())
        .addColumn('payload', 'jsonb', (col) => col.notNull())
        .addColumn('created_at', 'timestamptz', (col) =>
            col.defaultTo(sql`now()`).notNull(),
        )
        .execute();
};

export const down = async (db: Kysely<unknown>): Promise<void> => {
    await db.schema.dropTable('blocks').execute();
};
