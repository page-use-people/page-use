import {PostHog} from 'posthog-node';

type TTelemetryCaptureParams = {
    readonly distinctID: string;
    readonly event: string;
    readonly properties?: Record<string, unknown>;
    readonly ip?: string;
};

type TTelemetryAliasParams = {
    readonly distinctID: string;
    readonly alias: string;
};

type TTelemetry = {
    readonly capture: (params: TTelemetryCaptureParams) => void;
    readonly alias: (params: TTelemetryAliasParams) => void;
    readonly shutdown: () => Promise<void>;
};

const noopTelemetry: TTelemetry = Object.freeze({
    capture: () => {},
    alias: () => {},
    shutdown: async () => {},
});

const createTelemetry = (apiKey: string | undefined): TTelemetry => {
    if (!apiKey) {
        return noopTelemetry;
    }

    const client = new PostHog(apiKey, {
        host: 'https://us.i.posthog.com',
    });

    return Object.freeze({
        capture: ({
            distinctID,
            event,
            properties,
            ip,
        }: TTelemetryCaptureParams) => {
            client.capture({
                distinctId: distinctID,
                event,
                properties: {
                    ...properties,
                    ...(ip ? {$ip: ip} : {}),
                },
                disableGeoip: false,
            });
        },
        alias: ({distinctID, alias}: TTelemetryAliasParams) => {
            client.alias({distinctId: distinctID, alias});
        },
        shutdown: () => client.shutdown(),
    });
};

export {createTelemetry};
export type {TTelemetry};
