import {z} from 'zod';
import {
    renderFunctionType,
    renderVariableInterface,
} from '#client/render-types.mjs';
import {createClient} from '#client/trpc.mjs';
import {
    makeRunInAnimationFrames,
    type TRunInAnimationFrames,
} from '#client/animation.mjs';

const globals: {
    systemPrompt: string;
    contextInformation: {
        [key: string]: {
            title: string | null;
            content: string;
        };
    };
} = {
    systemPrompt: '',
    contextInformation: {},
};

const functions: {
    [name: string]: {
        name: string;
        inputType: z.ZodType;
        outputType: z.ZodType;
        writes?: readonly string[];
        settleTimeoutMs?: number;
        func: (input: any, signal?: AbortSignal) => Promise<any>;
    };
} = {};

const variables: {
    [name: string]: {
        value: any;
        type: z.ZodType;
        version: number;
    };
} = {};

const variableWaiters: {
    [name: string]: Set<(version: number) => void>;
} = {};

const STATE_WAIT_TIMEOUT_MS = 200;
const STATE_WAIT_RETRY_TIMEOUT_MS = 1000;
const STATE_SETTLE_QUIET_MS = 50;

const getOrderedVariableEntries = () =>
    Object.entries(variables).sort(([left], [right]) =>
        left.localeCompare(right),
    );

const getVariableVersion = (name: string): number =>
    variables[name]?.version ?? 0;

const getVariableVersionSnapshot = (): Record<string, number> =>
    Object.fromEntries(
        getOrderedVariableEntries().map(([key, value]) => [key, value.version]),
    );

const getChangedVariables = (
    baselineVersions: Record<string, number>,
): string[] =>
    Object.entries(baselineVersions)
        .filter(([name, version]) => getVariableVersion(name) > version)
        .map(([name]) => name);

const notifyVariableWaiters = (name: string, version: number) => {
    const waiters = variableWaiters[name];
    if (!waiters) {
        return;
    }

    for (const waiter of waiters) {
        waiter(version);
    }

    waiters.clear();
};

const waitForVariableVersion = (
    name: string,
    baselineVersion: number,
    timeoutMs: number,
): Promise<'updated' | 'timeout'> => {
    if (getVariableVersion(name) > baselineVersion) {
        return Promise.resolve('updated');
    }

    return new Promise((resolve) => {
        const waiters = variableWaiters[name] ?? new Set();
        variableWaiters[name] = waiters;

        const onVersion = (version: number) => {
            if (version <= baselineVersion) {
                return;
            }

            cleanup();
            resolve('updated');
        };

        const cleanup = () => {
            waiters.delete(onVersion);
            clearTimeout(timeout);

            if (waiters.size === 0) {
                delete variableWaiters[name];
            }
        };

        const timeout = setTimeout(() => {
            cleanup();
            resolve('timeout');
        }, timeoutMs);

        waiters.add(onVersion);
    });
};

const waitForVariableVersionWithRetry = async (
    name: string,
    baselineVersion: number,
    timeoutMs: number,
    retryTimeoutMs: number,
): Promise<'updated' | 'timeout'> => {
    const firstAttempt = await waitForVariableVersion(
        name,
        baselineVersion,
        timeoutMs,
    );
    if (firstAttempt === 'updated' || retryTimeoutMs <= 0) {
        return firstAttempt;
    }

    return waitForVariableVersion(name, baselineVersion, retryTimeoutMs);
};

const waitForAnyVariableUpdate = (
    baselineVersions: Record<string, number>,
    timeoutMs: number,
): Promise<{status: 'updated' | 'timeout'; variables: string[]}> => {
    const baselineNames = Object.keys(baselineVersions);
    if (baselineNames.length === 0) {
        return Promise.resolve({status: 'timeout', variables: []});
    }

    const changedVariables = getChangedVariables(baselineVersions);
    if (changedVariables.length > 0) {
        return Promise.resolve({
            status: 'updated',
            variables: changedVariables,
        });
    }

    return new Promise((resolve) => {
        const cleanupCallbacks: Array<() => void> = [];
        let settled = false;

        const finish = (status: 'updated' | 'timeout') => {
            if (settled) {
                return;
            }

            settled = true;
            clearTimeout(timeout);

            for (const cleanup of cleanupCallbacks) {
                cleanup();
            }

            resolve({
                status,
                variables:
                    status === 'updated'
                        ? getChangedVariables(baselineVersions)
                        : [],
            });
        };

        const timeout = setTimeout(() => finish('timeout'), timeoutMs);

        for (const name of baselineNames) {
            const waiters = variableWaiters[name] ?? new Set();
            variableWaiters[name] = waiters;

            const onVersion = (version: number) => {
                if (version <= (baselineVersions[name] ?? 0)) {
                    return;
                }

                finish('updated');
            };

            waiters.add(onVersion);
            cleanupCallbacks.push(() => {
                waiters.delete(onVersion);

                if (waiters.size === 0) {
                    delete variableWaiters[name];
                }
            });
        }
    });
};

const waitForSettledVariableUpdates = async (
    baselineVersions: Record<string, number>,
    timeoutMs: number,
    quietMs: number,
): Promise<{status: 'updated' | 'timeout'; variables: string[]}> => {
    const observedVariables = new Set<string>(
        getChangedVariables(baselineVersions),
    );
    const deadline = Date.now() + timeoutMs;
    let currentBaseline = getVariableVersionSnapshot();

    while (Date.now() < deadline) {
        const remaining = deadline - Date.now();
        const nextResult = await waitForAnyVariableUpdate(
            observedVariables.size > 0 ? currentBaseline : baselineVersions,
            Math.min(
                remaining,
                observedVariables.size > 0 ? quietMs : remaining,
            ),
        );

        if (nextResult.status === 'timeout') {
            return {
                status: observedVariables.size > 0 ? 'updated' : 'timeout',
                variables: [...observedVariables],
            };
        }

        for (const variable of nextResult.variables) {
            observedVariables.add(variable);
        }

        currentBaseline = getVariableVersionSnapshot();
    }

    return {
        status: observedVariables.size > 0 ? 'updated' : 'timeout',
        variables: [...observedVariables],
    };
};

const waitForSettledVariableUpdatesWithRetry = async (
    baselineVersions: Record<string, number>,
    timeoutMs: number,
    retryTimeoutMs: number,
    quietMs: number,
): Promise<{status: 'updated' | 'timeout'; variables: string[]}> => {
    const firstAttempt = await waitForSettledVariableUpdates(
        baselineVersions,
        timeoutMs,
        quietMs,
    );
    if (firstAttempt.status === 'updated' || retryTimeoutMs <= 0) {
        return firstAttempt;
    }

    return waitForSettledVariableUpdates(
        baselineVersions,
        retryTimeoutMs,
        quietMs,
    );
};

const getVariableSnapshot = (): Record<string, unknown> =>
    Object.fromEntries(
        getOrderedVariableEntries().map(([key, value]) => [key, value.value]),
    );

const serializeVariableSnapshot = (snapshot: Record<string, unknown>) =>
    JSON.stringify(
        snapshot,
        (_key, value) => {
            if (value instanceof Error) {
                return {
                    name: value.name,
                    message: value.message,
                    stack: value.stack,
                };
            }

            if (typeof value === 'undefined') {
                return '[undefined]';
            }

            if (typeof value === 'function') {
                return '[function]';
            }

            return value;
        },
        2,
    );

const normalizeIdentifier = (value: string) =>
    value.toLowerCase().replace(/[^a-z0-9]/g, '');

const inferFunctionWrites = (functionName: string): readonly string[] => {
    const normalizedFunctionName = normalizeIdentifier(functionName);
    if (!normalizedFunctionName) {
        return [];
    }

    const setterPrefixes = ['set', 'update', 'change', 'apply'];
    const candidateNames = new Set<string>([normalizedFunctionName]);

    for (const prefix of setterPrefixes) {
        if (
            normalizedFunctionName.startsWith(prefix) &&
            normalizedFunctionName.length > prefix.length
        ) {
            candidateNames.add(normalizedFunctionName.slice(prefix.length));
        }
    }

    const exactMatches = getOrderedVariableEntries()
        .map(([name]) => name)
        .filter((name) => candidateNames.has(normalizeIdentifier(name)));

    return exactMatches;
};

export function setVariable(options: {
    name: string;
    value: any;
    type: z.ZodType;
}) {
    const nextVersion = getVariableVersion(options.name) + 1;

    variables[options.name] = {
        value: options.value,
        type: options.type,
        version: nextVersion,
    };

    notifyVariableWaiters(options.name, nextVersion);

    return () => {
        delete variables[options.name];
        delete variableWaiters[options.name];
    };
}

export function unsetVariable(options: {name: string}) {
    delete variables[options.name];
    delete variableWaiters[options.name];
}

export function registerFunction(options: {
    name: string;
    input: z.ZodType;
    output: z.ZodType;
    writes?: readonly string[];
    settleTimeoutMs?: number;
    func: (input: any, signal?: AbortSignal) => Promise<any>;
}): () => void {
    functions[options.name] = {
        name: options.name,
        inputType: options.input,
        outputType: options.output,
        writes: options.writes,
        settleTimeoutMs: options.settleTimeoutMs,
        func: options.func,
    };

    return () => {
        delete functions[options.name];
    };
}

export function unregisterFunction(options: {name: string}): void {
    delete functions[options.name];
}

export function setSystemPrompt(prompt: string) {
    globals.systemPrompt = prompt;
}

export function setContextInformation(
    key: string,
    options: {title: string | null; content: string},
): () => void {
    globals.contextInformation[key] = options;

    return () => {
        delete globals.contextInformation[key];
    };
}

export function unsetContextInformation(key: string) {
    delete globals.contextInformation[key];
}

export function makeDelay(signal: AbortSignal) {
    return (ms: number) =>
        new Promise((resolve, reject) => {
            const timeout = setTimeout(resolve, ms);

            signal.addEventListener('abort', () => {
                clearTimeout(timeout);
                reject(signal.reason);
            });
        });
}

type TStubConsole = {
    log: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
    info: (...args: unknown[]) => void;
};

export function stubConsole(): [TStubConsole, string[]] {
    const logs: string[] = [];

    const logger = (...args: any[]) => {
        const stringArgs = args.map((arg) => {
            if (arg instanceof Error) {
                return `${arg.name}: ${arg.message}\n${arg.stack}`;
            } else if (typeof arg === 'string') {
                return arg;
            } else {
                return JSON.stringify(arg);
            }
        });

        logs.push(stringArgs.join(' '));
        console.debug('LLM', ...args);
    };

    return [
        {
            log: logger,
            error: logger,
            info: logger,
        },
        logs,
    ];
}

const createConversationId = () => crypto.randomUUID();

let conversationId = createConversationId();

export function resetConversation() {
    conversationId = createConversationId();
}

const isInvalidConversationHistoryError = (error: unknown): boolean =>
    String(error).includes(
        '`tool_use` ids were found without `tool_result` blocks immediately after',
    );

export type TRunStatus = 'running' | 'completed' | 'aborted' | 'error';

export type TRunUpdate =
    | {
          readonly type: 'text';
          readonly message: string;
      }
    | {
          readonly type: 'execution_start';
          readonly executionIdentifier: string;
          readonly description: string;
          readonly code: string;
      }
    | {
          readonly type: 'execution_result';
          readonly executionIdentifier: string;
          readonly description: string;
          readonly result: string;
          readonly error: string | null;
      }
    | {
          readonly type: 'waiting_for_state';
          readonly variables: readonly string[];
      }
    | {
          readonly type: 'state_update_observed';
          readonly variable: string;
      }
    | {
          readonly type: 'state_wait_timeout';
          readonly variables: readonly string[];
      };

export type TRunOptions = {
    readonly onMessage?: (message: string) => void;
    readonly onUpdate?: (update: TRunUpdate) => void;
    readonly onStatusChange?: (status: TRunStatus) => void;
    readonly onError?: (error: unknown) => void;
};

export type TRunHandle = {
    readonly abort: () => void;
    readonly done: Promise<void>;
};

let activeRunController: AbortController | null = null;

export function run(userPrompt: string, options?: TRunOptions): TRunHandle {
    if (activeRunController !== null) {
        throw new Error(
            'A Page Use response is already in progress. Wait for it to finish before sending another prompt.',
        );
    }

    const abortController = new AbortController();
    const signal = abortController.signal;
    const [stubCons, logs] = stubConsole();
    const client = createClient();
    activeRunController = abortController;
    options?.onStatusChange?.('running');

    const loop = async () => {
        const toolDefs = await Promise.all(
            Object.entries(functions).map(async ([name, value]) => ({
                definition: await renderFunctionType(
                    name,
                    value.inputType,
                    value.outputType,
                    name,
                ),
            })),
        );

        const funcNames = Object.keys(functions);
        type TTrackedFunctions = Record<
            string,
            (input: unknown) => Promise<unknown>
        >;
        type TUserBlock =
            | {type: 'text'; message: string}
            | {
                  type: 'execution_result';
                  execution_identifier: string;
                  result: string;
                  error: string | null;
              };

        let currentBlocks: TUserBlock[] = [
            {type: 'text' as const, message: userPrompt},
        ];
        let hasRetriedInvalidHistory = false;

        while (!signal.aborted) {
            const currentVariables = getVariableSnapshot();
            const variablesObjectDefinition = await renderVariableInterface(
                z.object(
                    Object.fromEntries(
                        getOrderedVariableEntries().map(([key, value]) => [
                            key,
                            value.type,
                        ]),
                    ),
                ),
            );
            const context = [
                ...Object.entries(globals.contextInformation).map(
                    ([_key, value]) => ({
                        title: value.title ?? undefined,
                        content: value.content,
                    }),
                ),
                {
                    title: 'current_variables',
                    content: serializeVariableSnapshot(currentVariables),
                },
            ];
            const isInitialUserPrompt =
                currentBlocks.length === 1 &&
                currentBlocks[0]?.type === 'text' &&
                currentBlocks[0].message === userPrompt;

            let response;
            const requestPayload = {
                conversation_id: conversationId,
                system_prompt: globals.systemPrompt,
                context,
                available_tools: toolDefs,
                variables_object_definition: variablesObjectDefinition,
                blocks: currentBlocks,
            };

            try {
                console.log('PAGE_USE_REQUEST', requestPayload);
                response =
                    await client.converse.converse.mutate(requestPayload);
            } catch (error) {
                if (
                    isInitialUserPrompt &&
                    !hasRetriedInvalidHistory &&
                    isInvalidConversationHistoryError(error)
                ) {
                    resetConversation();
                    hasRetriedInvalidHistory = true;
                    continue;
                }

                throw error;
            }

            const resultBlocks: TUserBlock[] = [];
            const textMessages: string[] = [];

            for (const block of response.blocks) {
                console.log('PAGE_USE_RESPONSE_BLOCK', block);

                if (block.type === 'text') {
                    textMessages.push(block.message);
                    options?.onUpdate?.({
                        type: 'text',
                        message: block.message,
                    });
                } else if (block.type === 'execution') {
                    //console.debug('CODE:\n', block.code);
                    const wrappedCode = [
                        `(async function({${funcNames.join(', ')}}, {variables, delay, runInAnimationFrames, console, abortSignal}) {`,
                        block.code,
                        '})',
                    ].join('\n');

                    options?.onUpdate?.({
                        type: 'execution_start',
                        executionIdentifier: block.execution_identifier,
                        description: block.description,
                        code: block.code,
                    });

                    logs.length = 0;
                    const touchedVariables = new Map<string, number>();
                    const fallbackBaselineVersions =
                        getVariableVersionSnapshot();
                    let requiresGenericStateWait = false;
                    let settleTimeoutMs = STATE_WAIT_TIMEOUT_MS;
                    const trackedFunctions: TTrackedFunctions =
                        Object.fromEntries(
                            Object.entries(functions).map(([name, value]) => [
                                name,
                                async (input: unknown) => {
                                    settleTimeoutMs = Math.max(
                                        settleTimeoutMs,
                                        value.settleTimeoutMs ??
                                            STATE_WAIT_TIMEOUT_MS,
                                    );
                                    const resolvedWrites =
                                        value.writes ??
                                        inferFunctionWrites(name);

                                    if (value.writes === undefined) {
                                        requiresGenericStateWait =
                                            requiresGenericStateWait ||
                                            resolvedWrites.length === 0;
                                    }

                                    for (const variableName of resolvedWrites) {
                                        if (
                                            !touchedVariables.has(variableName)
                                        ) {
                                            touchedVariables.set(
                                                variableName,
                                                getVariableVersion(
                                                    variableName,
                                                ),
                                            );
                                        }
                                    }

                                    const parsed = value.inputType.parse(input);
                                    return await value.func(parsed, signal);
                                },
                            ]),
                        );

                    const execController = new AbortController();
                    const execSignal = execController.signal;
                    const timeout = setTimeout(
                        () =>
                            execController.abort(
                                'execution timed out after 12s',
                            ),
                        12_000,
                    );
                    const onParentAbort = () =>
                        execController.abort(signal.reason);

                    signal.addEventListener('abort', onParentAbort, {
                        once: true,
                    });

                    let executionError: string | null = null;

                    try {
                        const fn = (0, eval)(wrappedCode) as (
                            funcs: TTrackedFunctions,
                            ctx: {
                                variables: Record<string, unknown>;
                                delay: ReturnType<typeof makeDelay>;
                                runInAnimationFrames: TRunInAnimationFrames;
                                console: typeof stubCons;
                                abortSignal: AbortSignal;
                            },
                        ) => Promise<void>;

                        await fn(trackedFunctions, {
                            variables: getVariableSnapshot(),
                            delay: makeDelay(execSignal),
                            runInAnimationFrames:
                                makeRunInAnimationFrames(execSignal),
                            console: stubCons,
                            abortSignal: execSignal,
                        });
                    } catch (err) {
                        executionError =
                            err instanceof Error
                                ? `${err.name}: ${err.message}\n${err.stack}`
                                : String(err);
                    } finally {
                        clearTimeout(timeout);
                        signal.removeEventListener('abort', onParentAbort);
                    }

                    const observedVariables = new Set<string>();
                    const waitVariables =
                        touchedVariables.size > 0
                            ? [...touchedVariables.keys()]
                            : [];

                    if (waitVariables.length > 0 || requiresGenericStateWait) {
                        console.log('PAGE_USE_STATE_WAIT', {
                            variables: waitVariables,
                            fallback: requiresGenericStateWait,
                        });
                        options?.onUpdate?.({
                            type: 'waiting_for_state',
                            variables: waitVariables,
                        });
                    }

                    const retryWaitTimeoutMs = Math.max(
                        STATE_WAIT_RETRY_TIMEOUT_MS,
                        settleTimeoutMs * 2,
                    );

                    if (waitVariables.length > 0) {
                        const settleResults = await Promise.all(
                            waitVariables.map(async (variableName) => {
                                const status =
                                    await waitForVariableVersionWithRetry(
                                        variableName,
                                        touchedVariables.get(variableName) ?? 0,
                                        settleTimeoutMs,
                                        retryWaitTimeoutMs,
                                    );

                                if (status === 'updated') {
                                    observedVariables.add(variableName);
                                    options?.onUpdate?.({
                                        type: 'state_update_observed',
                                        variable: variableName,
                                    });
                                }

                                return {
                                    variable: variableName,
                                    status,
                                };
                            }),
                        );

                        const timedOutVariables = settleResults
                            .filter((result) => result.status === 'timeout')
                            .map((result) => result.variable);

                        console.log('PAGE_USE_STATE_WAIT_RESULT', {
                            results: settleResults,
                        });

                        if (timedOutVariables.length > 0) {
                            options?.onUpdate?.({
                                type: 'state_wait_timeout',
                                variables: timedOutVariables,
                            });
                        }
                    }

                    if (requiresGenericStateWait) {
                        const genericWaitResult =
                            await waitForSettledVariableUpdatesWithRetry(
                                fallbackBaselineVersions,
                                settleTimeoutMs,
                                retryWaitTimeoutMs,
                                STATE_SETTLE_QUIET_MS,
                            );

                        for (const variableName of genericWaitResult.variables) {
                            if (observedVariables.has(variableName)) {
                                continue;
                            }

                            observedVariables.add(variableName);
                            options?.onUpdate?.({
                                type: 'state_update_observed',
                                variable: variableName,
                            });
                        }

                        console.log('PAGE_USE_STATE_WAIT_RESULT', {
                            fallback: genericWaitResult,
                        });

                        if (
                            genericWaitResult.status === 'timeout' &&
                            genericWaitResult.variables.length === 0
                        ) {
                            options?.onUpdate?.({
                                type: 'state_wait_timeout',
                                variables: [],
                            });
                        }
                    }

                    const executionResult = {
                        type: 'execution_result' as const,
                        execution_identifier: block.execution_identifier,
                        result: logs.join('\n'),
                        error: executionError,
                    };
                    resultBlocks.push(executionResult);
                    console.log('PAGE_USE_EXECUTION_RESULT', {
                        execution_identifier:
                            executionResult.execution_identifier,
                        description: block.description,
                        result: executionResult.result,
                        error: executionResult.error,
                    });
                    options?.onUpdate?.({
                        type: 'execution_result',
                        executionIdentifier:
                            executionResult.execution_identifier,
                        description: block.description,
                        result: executionResult.result,
                        error: executionResult.error,
                    });
                }
            }

            if (resultBlocks.length === 0) {
                for (const message of textMessages) {
                    options?.onMessage?.(message);
                }
            }

            if (resultBlocks.length === 0) {
                break;
            }

            hasRetriedInvalidHistory = false;
            currentBlocks = resultBlocks;
        }
    };

    const done = loop()
        .then(() => {
            options?.onStatusChange?.(signal.aborted ? 'aborted' : 'completed');
        })
        .catch((err) => {
            if (signal.aborted) {
                options?.onStatusChange?.('aborted');
                return;
            }

            if (isInvalidConversationHistoryError(err)) {
                resetConversation();
            }

            console.error('run loop error:', err);
            options?.onError?.(err);
            options?.onStatusChange?.('error');
        })
        .finally(() => {
            if (activeRunController === abortController) {
                activeRunController = null;
            }
        });

    return {
        abort: () => abortController.abort(),
        done,
    };
}

export const main = async (url?: string): Promise<void> => {
    // const client = createClient(url ? {url} : undefined);
    // const result = await client.health.check.query();
    // console.log('health.check result:', result);

    const toolTypes = await renderFunctionType(
        'getPage',
        z.number().describe('the page id'),
        z
            .object({
                page: z
                    .object({
                        id: z.string(),
                    })
                    .describe('a single page represented'),
            })
            .describe('tomato'),
        'Get a page by ID',
    );

    console.log(toolTypes);

    const variableTypes = await renderVariableInterface(
        z
            .object({
                count: z.number().describe('the number of pages available'),
            })
            .describe('the `variables` object is of type `TVariables`'),
    );

    console.log(variableTypes);
};

(window as any).run = run;
