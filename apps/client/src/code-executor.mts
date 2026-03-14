// Sandbox for executing AI-generated code with abort support, mutation tracking,
// and console capture. Code is wrapped as an async IIFE, eval'd in global scope,
// and given access to registered functions, live variables, and timing utilities.

import {
    makeRunInAnimationFrames,
    type TRunInAnimationFrames,
} from '#client/animation.mjs';
import type {TRunUpdate} from '#client/types.mjs';
import type {TRegisteredFunction} from '#client/registry.mjs';
import {
    MUTATION_QUIET_MS,
    createLiveProxy,
    ensureRegistered,
    getVariableVersion,
    getVersionSnapshot,
    getVersionSnapshotFor,
    waitForMutations,
} from '#client/variables.mjs';

type TSandboxConsole = {
    readonly log: (...args: unknown[]) => void;
    readonly error: (...args: unknown[]) => void;
    readonly info: (...args: unknown[]) => void;
};

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

// --- Abort utilities ---

// Promise-based setTimeout that rejects immediately if the signal is already
// aborted, and cleans up the timer + listener whichever fires first.
const createAbortableTimeout = (
    signal: AbortSignal,
    ms: number,
): Promise<void> =>
    new Promise<void>((resolve, reject) => {
        signal.throwIfAborted();
        const id = setTimeout(() => {
            signal.removeEventListener('abort', onAbort);
            resolve();
        }, ms);
        const onAbort = () => {
            clearTimeout(id);
            reject(signal.reason);
        };
        signal.addEventListener('abort', onAbort, {once: true});
    });

// Pushes execution to the next macrotask (setTimeout 0) so that DOM updates
// and state changes from prior microtasks have settled before the function runs.
const deferExecution = async <TValue,>(
    func: () => Promise<TValue>,
    signal: AbortSignal,
): Promise<TValue> => {
    await createAbortableTimeout(signal, 0);
    return await func();
};

const createDelay = (signal: AbortSignal) => (ms: number) =>
    createAbortableTimeout(signal, ms);

// Two-tier abort: the child controller aborts if the parent does (user cancels
// the whole run) or if its own timeout fires (single execution took too long).
// cleanup() removes both the timeout and parent listener to prevent leaks.
const createChildAbortController = (
    parentSignal: AbortSignal,
    timeoutMs: number,
): {signal: AbortSignal; cleanup: () => void} => {
    const controller = new AbortController();
    const timeoutId = setTimeout(
        () =>
            controller.abort(`execution timed out after ${timeoutMs / 1000}s`),
        timeoutMs,
    );
    const onParentAbort = () => controller.abort(parentSignal.reason);
    parentSignal.addEventListener('abort', onParentAbort, {once: true});

    return {
        signal: controller.signal,
        cleanup: () => {
            clearTimeout(timeoutId);
            parentSignal.removeEventListener('abort', onParentAbort);
        },
    };
};

// --- Sandbox helpers ---

// Errors get full stack traces; objects get JSON; everything else is stringified.
const formatLoggedValue = (value: unknown): string => {
    if (value instanceof Error) {
        return `${value.name}: ${value.message}\n${value.stack}`;
    }

    if (typeof value === 'string') {
        return value;
    }

    const serializedValue = JSON.stringify(value);
    return serializedValue ?? String(value);
};

// All console methods (log/error/info) funnel to one appender — the AI sees
// captured output as a single stream, severity levels are not distinguished.
const createSandboxConsole = (): [TSandboxConsole, string[]] => {
    const capturedLogLines: string[] = [];

    const appendLogLine = (...args: unknown[]) => {
        capturedLogLines.push(args.map(formatLoggedValue).join(' '));
        console.debug('LLM', ...args);
    };

    return [
        {
            log: appendLogLine,
            error: appendLogLine,
            info: appendLogLine,
        },
        capturedLogLines,
    ];
};

// Wraps the AI's code as an async IIFE with two destructured parameters:
// 1st arg = registered functions by name, 2nd arg = context utilities
// (variables, delay, animations, mutation waiter, console, abortSignal).
const wrapCodeAsFunction = (
    availableFunctionNames: readonly string[],
    code: string,
): string =>
    [
        `(async function({${availableFunctionNames.join(', ')}}, {variables, delay, runInAnimationFrames, waitForMutation, console, abortSignal}) {`,
        code,
        '})',
    ].join('\n');

const formatError = (error: unknown): string =>
    error instanceof Error
        ? `${error.name}: ${error.message}\n${error.stack}`
        : String(error);

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
