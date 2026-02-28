import {defineConfig} from 'kysely-ctl';
import pg from 'pg';

export default defineConfig({
    dialect: 'pg',
    dialectConfig: {
        pool: new pg.Pool({
            connectionString: process.env.DATABASE_URL,
        }),
    },
    migrations: {
        migrationFolder: 'migrations',
    },
    seeds: {
        seedFolder: 'seeds',
    },
});
