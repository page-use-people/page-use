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
export {
    main,
    run,
    resetConversation,
    registerFunction,
    unregisterFunction,
    setSystemPrompt,
    setContextInformation,
    unsetContextInformation,
    setVariable,
    unsetVariable,
} from '#client/main.mjs';

export type {
    TRunHandle,
    TRunOptions,
    TRunStatus,
    TRunUpdate,
} from '#client/main.mjs';

export {
    renderFunctionType,
    renderVariableInterface,
} from '#client/render-types.mjs';
