type TGreeting = {
    readonly message: string;
    readonly timestamp: string;
};

export const greet = (name: string): TGreeting => ({
    message: `Hello, ${name}!`,
    timestamp: new Date().toISOString(),
});

export type {TGreeting};

// tRPC client
export {
    createClient,
    type TClient,
    type TClientOptions,
} from '#client/trpc.mjs';

// Codegen
export {main} from '#client/main.mjs';
export {renderFunctionType, renderVariableInterface} from '#client/render-types.mjs';
