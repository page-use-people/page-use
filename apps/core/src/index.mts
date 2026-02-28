export {type TAppRouter} from '#core/trpc/index.mjs';

import express from 'express';
import cors from 'cors';
import {createExpressMiddleware} from '@trpc/server/adapters/express';
import {appRouter} from '#core/trpc/index.mjs';
import {createContextCreator} from '#core/trpc/context.mjs';
import {createServices} from '#core/services/index.mjs';
import type {TServices} from '#core/services/types.mjs';
import {env} from '#core/env.mjs';
import {logger} from '#core/logger.mjs';

const TRPC_ENDPOINT = '/trpc';

const startServer = async (services: TServices) => {
    const createContext = createContextCreator(services);

    const app = express();

    app.set('trust proxy', true);
    app.use(cors());

    // REST health / welcome endpoint
    app.get('/', (_req, res) => {
        res.json({
            message: 'welcome to page-use',
            timestamp: new Date().toISOString(),
        });
    });

    // tRPC with SSE transport support (enabled via sse config in trpc.mts)
    app.use(
        TRPC_ENDPOINT,
        createExpressMiddleware({
            router: appRouter,
            createContext: createContext,
        }),
    );

    app.listen(env.CORE_PORT, () => {
        logger.info(`core listening on http://localhost:${env.CORE_PORT}`);
        logger.info(
            `trpc endpoint at http://localhost:${env.CORE_PORT}${TRPC_ENDPOINT}`,
        );
    });
};

const services = createServices();

startServer(services);
