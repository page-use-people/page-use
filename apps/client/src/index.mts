// tRPC client
export {
    createClient,
    type TClient,
    type TClientOptions,
} from '#client/trpc.mjs';

// Runtime
export {run} from '#client/runner.mjs';

export {
    registerFunction,
    unregisterFunction,
    resetConversation,
    setSystemPrompt,
    setContextInformation,
    unsetContextInformation,
} from '#client/registry.mjs';

export {setVariable, unsetVariable} from '#client/variables.mjs';

export type {
    TRunHandle,
    TRunOptions,
    TRunStatus,
    TRunUpdate,
} from '#client/types.mjs';

// Type rendering
export {
    renderFunctionType,
    renderVariableInterface,
} from '#client/type-renderer.mjs';

// Animation
export {
    makeRunInAnimationFrames,
    type TEasingName,
    type TAnimationOptions,
    type TAnimationCallback,
    type TRunInAnimationFrames,
} from '#client/animation.mjs';
