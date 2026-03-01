import {createClient} from '#client/trpc.mjs';

export const main = async (url?: string): Promise<void> => {
    const client = createClient(url ? {url} : undefined);
    const result = await client.health.check.query();
    console.log('health.check result:', result);
};
