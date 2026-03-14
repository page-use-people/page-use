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

const deferExecution = async <TValue,>(
    func: () => Promise<TValue>,
    signal: AbortSignal,
): Promise<TValue> => {
    await createAbortableTimeout(signal, 0);
    return await func();
};

const createDelay = (signal: AbortSignal) => (ms: number) =>
    createAbortableTimeout(signal, ms);

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

const emitVariableUpdates = (
    observedNames: readonly string[],
    onUpdate?: (update: TRunUpdate) => void,
): void => {
    observedNames.forEach((name) => {
        onUpdate?.({type: 'state_update_observed', variable: name});
    });
};

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
