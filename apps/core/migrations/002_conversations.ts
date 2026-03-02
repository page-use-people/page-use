import type {Kysely} from 'kysely';
import {sql} from 'kysely';

export const up = async (db: Kysely<unknown>): Promise<void> => {
    await db.schema
        .createTable('conversations')
        .addColumn('id', 'uuid', (col) => col.primaryKey())
        .addColumn('last_turn_by', 'varchar(20)', (col) => col.notNull())
        .addColumn('last_message_at', 'timestamptz', (col) => col.notNull())
        .addColumn('model', 'varchar(50)', (col) => col.notNull())
        .addColumn('created_at', 'timestamptz', (col) =>
            col.defaultTo(sql`now()`).notNull(),
        )
        .execute();
};

export const down = async (db: Kysely<unknown>): Promise<void> => {
    await db.schema.dropTable('conversations').execute();
};
