// Sandbox for executing AI-generated code with abort support, mutation tracking,
// and console capture. Code is wrapped as an async IIFE, eval'd in global scope,
// and given access to registered functions, live variables, and timing utilities.

import {
    makeRunInAnimationFrames,
    type TRunInAnimationFrames,
} from '#client/lib/animation.mjs';
import type {TRunUpdate} from '#client/types.mjs';
import type {TRegisteredFunction} from '#client/registry/functions.mjs';
import {
    MUTATION_QUIET_MS,
    createLiveProxy,
    ensureRegistered,
    getVariableVersion,
    getVersionSnapshot,
    getVersionSnapshotFor,
    waitForMutations,
} from '#client/registry/variables.mjs';

import {
    createChildAbortController,
    createDelay,
    deferExecution,
} from './abort.mjs';
import {
    createSandboxConsole,
    formatError,
    wrapCodeAsFunction,
    type TSandboxConsole,
} from './sandbox.mjs';

type TTrackedFunctions = Record<string, (input: unknown) => Promise<unknown>>;

type TCodeBlock = {
    readonly executionIdentifier: string;
    readonly description: string;
    readonly code: string;
};

type TCodeResult = {
    readonly result: string;
    readonly error: string | null;
};

export const MUTATION_TIMEOUT_MS = 5_000;
const EXECUTION_TIMEOUT_MS = 12_000;

// --- Mutation tracking ---

// Emits a 'state_update_observed' event for each variable that changed.
const emitVariableUpdates = (
    observedNames: readonly string[],
    onUpdate?: (update: TRunUpdate) => void,
): void => {
    observedNames.forEach((name) => {
        onUpdate?.({type: 'state_update_observed', variable: name});
    });
};

// Automatic post-call wait: if a function declares it mutates certain variables,
// this pauses until those variables change (or the timeout expires). This lets
// the system capture the effects of async side-effects before returning to the AI.
const awaitDeclaredMutations = async (options: {
    registeredFunction: TRegisteredFunction;
    declaredMutationBaseline: Record<string, number>;
    executionSignal: AbortSignal;
    onUpdate?: (update: TRunUpdate) => void;
}): Promise<void> => {
    const declaredNames = [
        ...new Set(options.registeredFunction.mutates ?? []),
    ];
    if (declaredNames.length === 0) {
        return;
    }

    options.onUpdate?.({
        type: 'waiting_for_state',
        variables: declaredNames,
    });

    const result = await waitForMutations({
        baselineVersions: options.declaredMutationBaseline,
        signal: options.executionSignal,
        quietMs: MUTATION_QUIET_MS,
        timeoutMs:
            options.registeredFunction.mutationTimeoutMs ?? MUTATION_TIMEOUT_MS,
    });

    emitVariableUpdates(result.variables, options.onUpdate);

    if (result.status === 'timeout') {
        options.onUpdate?.({
            type: 'state_wait_timeout',
            variables: declaredNames,
        });
    }
};

// Manual mutation waiter exposed to sandbox code as `waitForMutation()`.
// Unlike awaitDeclaredMutations (automatic, per-function-call), this lets the
// AI's code explicitly wait for specific variables. The baseline advances
// across calls so repeated waits don't re-trigger on already-seen changes.
const createMutationWaiter = (options: {
    executionSignal: AbortSignal;
    onUpdate?: (update: TRunUpdate) => void;
}): ((variableNames: string[]) => Promise<string[]>) => {
    const baseline = getVersionSnapshot();

    return async (variableNames: string[]): Promise<string[]> => {
        const uniqueNames = [...new Set(variableNames)];

        if (uniqueNames.length === 0) {
            return [];
        }

        ensureRegistered(uniqueNames);

        options.onUpdate?.({
            type: 'waiting_for_state',
            variables: uniqueNames,
        });

        const result = await waitForMutations({
            baselineVersions: Object.fromEntries(
                uniqueNames.map((name) => [
                    name,
                    baseline[name] ?? getVariableVersion(name),
                ]),
            ),
            signal: options.executionSignal,
            quietMs: MUTATION_QUIET_MS,
            timeoutMs: MUTATION_TIMEOUT_MS,
        });

        const nextVersions = getVersionSnapshotFor(uniqueNames);

        for (const name of uniqueNames) {
            baseline[name] = nextVersions[name] ?? getVariableVersion(name);
        }

        emitVariableUpdates(result.variables, options.onUpdate);

        if (result.status === 'timeout') {
            options.onUpdate?.({
                type: 'state_wait_timeout',
                variables: uniqueNames,
            });
        }

        return result.variables;
    };
};

// Wraps each registered function so that: (1) input is validated via Zod,
// (2) mutation baselines are snapshot *before* execution, (3) the call is
// deferred to the next macrotask, and (4) declared mutations are awaited after.
const createTrackedFunctions = (options: {
    registeredFunctionEntries: ReadonlyArray<[string, TRegisteredFunction]>;
    executionSignal: AbortSignal;
    onUpdate?: (update: TRunUpdate) => void;
}): TTrackedFunctions =>
    Object.fromEntries(
        options.registeredFunctionEntries.map(
            ([functionName, registeredFunction]) => [
                functionName,
                async (input: unknown) => {
                    const parsedInput =
                        registeredFunction.inputType.parse(input);
                    const declaredNames = [
                        ...new Set(registeredFunction.mutates ?? []),
                    ];
                    const declaredMutationBaseline =
                        getVersionSnapshotFor(declaredNames);

                    const result = await deferExecution(
                        async () =>
                            await registeredFunction.func(
                                parsedInput,
                                options.executionSignal,
                            ),
                        options.executionSignal,
                    );

                    await awaitDeclaredMutations({
                        registeredFunction,
                        declaredMutationBaseline,
                        executionSignal: options.executionSignal,
                        onUpdate: options.onUpdate,
                    });

                    return result;
                },
            ],
        ),
    );

// --- Code execution ---

export const executeCodeBlock = async (options: {
    block: TCodeBlock;
    registeredFunctionEntries: ReadonlyArray<[string, TRegisteredFunction]>;
    parentAbortSignal: AbortSignal;
    onUpdate?: (update: TRunUpdate) => void;
}): Promise<TCodeResult> => {
    const functionNames = options.registeredFunctionEntries.map(
        ([name]) => name,
    );
    const wrappedSource = wrapCodeAsFunction(functionNames, options.block.code);
    const [sandboxConsole, logLines] = createSandboxConsole();

    options.onUpdate?.({
        type: 'execution_start',
        executionIdentifier: options.block.executionIdentifier,
        description: options.block.description,
        code: options.block.code,
    });

    const {signal: executionSignal, cleanup} = createChildAbortController(
        options.parentAbortSignal,
        EXECUTION_TIMEOUT_MS,
    );

    let executionError: string | null = null;

    try {
        // (0, eval) is indirect eval — it runs in global scope rather than
        // inheriting the local closure, preventing sandbox code from accessing
        // the executor's internal variables.
        const executeCode = (0, eval)(wrappedSource) as (
            trackedFunctions: TTrackedFunctions,
            context: {
                variables: Record<string, unknown>;
                delay: (ms: number) => Promise<void>;
                runInAnimationFrames: TRunInAnimationFrames;
                waitForMutation: (variableNames: string[]) => Promise<string[]>;
                console: TSandboxConsole;
                abortSignal: AbortSignal;
            },
        ) => Promise<void>;

        await executeCode(
            createTrackedFunctions({
                registeredFunctionEntries: options.registeredFunctionEntries,
                executionSignal,
                onUpdate: options.onUpdate,
            }),
            {
                variables: createLiveProxy(),
                delay: createDelay(executionSignal),
                runInAnimationFrames: makeRunInAnimationFrames(executionSignal),
                waitForMutation: createMutationWaiter({
                    executionSignal,
                    onUpdate: options.onUpdate,
                }),
                console: sandboxConsole,
                abortSignal: executionSignal,
            },
        );
    } catch (error) {
        executionError = formatError(error);
    } finally {
        cleanup();
    }

    return {
        result: logLines.join('\n'),
        error: executionError,
    };
};
