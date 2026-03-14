import {
    makeRunInAnimationFrames,
    type TRunInAnimationFrames,
} from '#client/animation.mjs';
import type {TRunUpdate} from '#client/run-types.mjs';
import type {TRegisteredFunction} from '#client/runtime-state.mjs';
import {
    VARIABLE_MUTATION_TIMEOUT_MS,
    createLiveVariablesObject,
    ensureRegisteredVariableNames,
    getVariableVersion,
    getVariableVersionSnapshot,
    getVariableVersionSnapshotForNames,
    waitForVariableMutations,
} from '#client/variable-observer.mjs';

type TStubConsole = {
    readonly log: (...args: unknown[]) => void;
    readonly error: (...args: unknown[]) => void;
    readonly info: (...args: unknown[]) => void;
};

type TTrackedFunctions = Record<string, (input: unknown) => Promise<unknown>>;

type TAssistantExecutionBlock = {
    readonly executionIdentifier: string;
    readonly description: string;
    readonly code: string;
};

type TExecutionResult = {
    readonly result: string;
    readonly error: string | null;
};

export const DEFAULT_VARIABLE_WAIT_TIMEOUT_MS = 5_000;
const EXECUTION_TIMEOUT_MS = 12_000;

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

const createStubConsole = (): [TStubConsole, string[]] => {
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

const invokeFunctionOnNextTick = async <TValue,>(
    func: () => Promise<TValue>,
    signal: AbortSignal,
): Promise<TValue> =>
    await new Promise<TValue>((resolve, reject) => {
        if (signal.aborted) {
            reject(signal.reason);
            return;
        }

        let hasSettled = false;

        const finish = (
            callback: (value: TValue) => void,
            value: TValue,
        ): void => {
            if (hasSettled) {
                return;
            }

            hasSettled = true;
            signal.removeEventListener('abort', abortFunctionInvocation);
            callback(value);
        };

        const abortFunctionInvocation = () => {
            if (hasSettled) {
                return;
            }

            hasSettled = true;
            clearTimeout(scheduleTimeoutId);
            signal.removeEventListener('abort', abortFunctionInvocation);
            reject(signal.reason);
        };

        const scheduleTimeoutId = setTimeout(() => {
            void func().then(
                (value) => finish(resolve, value),
                (error) => {
                    if (hasSettled) {
                        return;
                    }

                    hasSettled = true;
                    signal.removeEventListener(
                        'abort',
                        abortFunctionInvocation,
                    );
                    reject(error);
                },
            );
        }, 0);

        signal.addEventListener('abort', abortFunctionInvocation, {once: true});
    });

const makeDelay = (signal: AbortSignal) => (ms: number) =>
    new Promise<void>((resolve, reject) => {
        const timeoutId = setTimeout(resolve, ms);

        const abortDelay = () => {
            clearTimeout(timeoutId);
            reject(signal.reason);
        };

        signal.addEventListener('abort', abortDelay, {once: true});
    });

const emitObservedVariableUpdates = (
    observedVariableNames: readonly string[],
    onUpdate?: (update: TRunUpdate) => void,
): void => {
    for (const observedVariableName of observedVariableNames) {
        onUpdate?.({
            type: 'state_update_observed',
            variable: observedVariableName,
        });
    }
};

const waitForDeclaredMutations = async (options: {
    registeredFunction: TRegisteredFunction;
    declaredMutationBaselineVersions: Record<string, number>;
    executionSignal: AbortSignal;
    onUpdate?: (update: TRunUpdate) => void;
}): Promise<void> => {
    const declaredMutationVariableNames = [
        ...new Set(options.registeredFunction.mutates ?? []),
    ];
    if (declaredMutationVariableNames.length === 0) {
        return;
    }

    options.onUpdate?.({
        type: 'waiting_for_state',
        variables: declaredMutationVariableNames,
    });

    const mutationResult = await waitForVariableMutations({
        baselineVersions: options.declaredMutationBaselineVersions,
        signal: options.executionSignal,
        quietMs: VARIABLE_MUTATION_TIMEOUT_MS,
        timeoutMs:
            options.registeredFunction.mutationTimeoutMs ??
            DEFAULT_VARIABLE_WAIT_TIMEOUT_MS,
    });

    emitObservedVariableUpdates(mutationResult.variables, options.onUpdate);

    if (mutationResult.status === 'timeout') {
        options.onUpdate?.({
            type: 'state_wait_timeout',
            variables: declaredMutationVariableNames,
        });
    }
};

const createWaitForMutation = (options: {
    executionSignal: AbortSignal;
    onUpdate?: (update: TRunUpdate) => void;
}): ((variableNames: string[]) => Promise<string[]>) => {
    const waitForMutationBaselineVersions = getVariableVersionSnapshot();

    return async (variableNames: string[]): Promise<string[]> => {
        const uniqueVariableNames = [...new Set(variableNames)];

        if (uniqueVariableNames.length === 0) {
            return [];
        }

        ensureRegisteredVariableNames(uniqueVariableNames);

        options.onUpdate?.({
            type: 'waiting_for_state',
            variables: uniqueVariableNames,
        });

        const mutationResult = await waitForVariableMutations({
            baselineVersions: Object.fromEntries(
                uniqueVariableNames.map((variableName) => [
                    variableName,
                    waitForMutationBaselineVersions[variableName] ??
                        getVariableVersion(variableName),
                ]),
            ),
            signal: options.executionSignal,
            quietMs: VARIABLE_MUTATION_TIMEOUT_MS,
            timeoutMs: DEFAULT_VARIABLE_WAIT_TIMEOUT_MS,
        });

        const nextVariableVersions =
            getVariableVersionSnapshotForNames(uniqueVariableNames);
        
        for (const variableName of uniqueVariableNames) {
            waitForMutationBaselineVersions[variableName] =
                nextVariableVersions[variableName] ??
                getVariableVersion(variableName);
        }

        emitObservedVariableUpdates(mutationResult.variables, options.onUpdate);

        if (mutationResult.status === 'timeout') {
            options.onUpdate?.({
                type: 'state_wait_timeout',
                variables: uniqueVariableNames,
            });
        }

        return mutationResult.variables;
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
                    const declaredMutationVariableNames = [
                        ...new Set(registeredFunction.mutates ?? []),
                    ];
                    const declaredMutationBaselineVersions =
                        getVariableVersionSnapshotForNames(
                            declaredMutationVariableNames,
                        );

                    const functionResult = await invokeFunctionOnNextTick(
                        async () =>
                            await registeredFunction.func(
                                parsedInput,
                                options.executionSignal,
                            ),
                        options.executionSignal,
                    );

                    await waitForDeclaredMutations({
                        registeredFunction,
                        declaredMutationBaselineVersions,
                        executionSignal: options.executionSignal,
                        onUpdate: options.onUpdate,
                    });

                    return functionResult;
                },
            ],
        ),
    );

const createWrappedExecutionSource = (
    availableFunctionNames: readonly string[],
    assistantCode: string,
): string =>
    [
        `(async function({${availableFunctionNames.join(', ')}}, {variables, delay, runInAnimationFrames, waitForMutation, console, abortSignal}) {`,
        assistantCode,
        '})',
    ].join('\n');

const formatExecutionError = (error: unknown): string =>
    error instanceof Error
        ? `${error.name}: ${error.message}\n${error.stack}`
        : String(error);

export const executeAssistantExecutionBlock = async (options: {
    block: TAssistantExecutionBlock;
    registeredFunctionEntries: ReadonlyArray<[string, TRegisteredFunction]>;
    parentAbortSignal: AbortSignal;
    onUpdate?: (update: TRunUpdate) => void;
}): Promise<TExecutionResult> => {
    const availableFunctionNames = options.registeredFunctionEntries.map(
        ([functionName]) => functionName,
    );
    const wrappedExecutionSource = createWrappedExecutionSource(
        availableFunctionNames,
        options.block.code,
    );
    const [stubConsole, capturedLogLines] = createStubConsole();

    options.onUpdate?.({
        type: 'execution_start',
        executionIdentifier: options.block.executionIdentifier,
        description: options.block.description,
        code: options.block.code,
    });

    const executionAbortController = new AbortController();
    const executionSignal = executionAbortController.signal;
    const executionTimeoutId = setTimeout(
        () => executionAbortController.abort('execution timed out after 12s'),
        EXECUTION_TIMEOUT_MS,
    );
    const abortExecutionFromRunSignal = () =>
        executionAbortController.abort(options.parentAbortSignal.reason);

    options.parentAbortSignal.addEventListener(
        'abort',
        abortExecutionFromRunSignal,
        {once: true},
    );

    let executionError: string | null = null;

    try {
        const executeAssistantCode = (0, eval)(wrappedExecutionSource) as (
            trackedFunctions: TTrackedFunctions,
            executionContext: {
                variables: Record<string, unknown>;
                delay: ReturnType<typeof makeDelay>;
                runInAnimationFrames: TRunInAnimationFrames;
                waitForMutation: (variableNames: string[]) => Promise<string[]>;
                console: TStubConsole;
                abortSignal: AbortSignal;
            },
        ) => Promise<void>;

        await executeAssistantCode(
            createTrackedFunctions({
                registeredFunctionEntries: options.registeredFunctionEntries,
                executionSignal,
                onUpdate: options.onUpdate,
            }),
            {
                variables: createLiveVariablesObject(),
                delay: makeDelay(executionSignal),
                runInAnimationFrames: makeRunInAnimationFrames(executionSignal),
                waitForMutation: createWaitForMutation({
                    executionSignal,
                    onUpdate: options.onUpdate,
                }),
                console: stubConsole,
                abortSignal: executionSignal,
            },
        );
    } catch (error) {
        executionError = formatExecutionError(error);
    } finally {
        clearTimeout(executionTimeoutId);
        options.parentAbortSignal.removeEventListener(
            'abort',
            abortExecutionFromRunSignal,
        );
    }

    return {
        result: capturedLogLines.join('\n'),
        error: executionError,
    };
};
