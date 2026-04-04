// Configuration
export {configure, type TConfig} from '#client/config.mjs';

// tRPC client
export {
    createClient,
    type TClient,
    type TClientOptions,
} from '#client/trpc.mjs';

// Runtime
export {run} from '#client/execution/runner.mjs';

// Registry — functions
export {
    registerFunction,
    unregisterFunction,
    type TFunctionOptions,
} from '#client/registry/functions.mjs';

// Registry — context & conversation
export {
    resetConversation,
    setSystemPrompt,
    setContextInformation,
    unsetContextInformation,
} from '#client/registry/context.mjs';

// Registry — variables
export {
    setVariable,
    unsetVariable,
    type TVariableOptions,
} from '#client/registry/variables.mjs';

// Types
export type {
    TRunHandle,
    TRunOptions,
    TRunStatus,
    TRunUpdate,
} from '#client/types.mjs';

// Utilities
export {default as dedent} from 'dedent';

// Type rendering
export {
    renderFunctionType,
    renderVariableInterface,
} from '#client/lib/type-renderer.mjs';

// Zod (re-exported for version compatibility)
export {z} from 'zod';

// Animation
export {
    makeRunInAnimationFrames,
    type TEasingName,
    type TAnimationOptions,
    type TAnimationCallback,
    type TRunInAnimationFrames,
} from '#client/lib/animation.mjs';
