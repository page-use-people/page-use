import type {CreateExpressContextOptions} from '@trpc/server/adapters/express';
import type {TServices} from '#core/services/types.mjs';

type TContext = {
    readonly services: TServices;
    readonly ip: string;
    readonly userAgent: string;
    readonly authToken: string | null;
};

const extractBearerToken = (header: string | undefined): string | null =>
    header?.startsWith('Bearer ') ? header.slice(7) : null;

const createContextCreator =
    (services: TServices) =>
    async ({req, info}: CreateExpressContextOptions): Promise<TContext> => {
        const headerToken = extractBearerToken(req.headers.authorization);
        const connectionParamToken = info.connectionParams?.token ?? null;
        const authToken = headerToken ?? connectionParamToken;
        const ip = req.ip ?? 'unknown';
        const userAgent = req.headers['user-agent'] ?? 'unknown';

        return {
            services,
            ip,
            userAgent,
            authToken,
        };
    };

export {createContextCreator};
export type {TContext};
