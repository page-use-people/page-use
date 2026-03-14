
// tRPC client
export {
    createClient,
    type TClient,
    type TClientOptions,
} from '#client/trpc.mjs';

// Runtime
export {
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

// Animation
export {
    makeRunInAnimationFrames,
    type TEasingName,
    type TAnimationOptions,
    type TAnimationCallback,
    type TRunInAnimationFrames,
} from '#client/animation.mjs';
