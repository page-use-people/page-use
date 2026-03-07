import {z} from 'zod';
import {
    renderFunctionType,
    renderVariableInterface,
} from '#client/render-types.mjs';
import {createClient} from '#client/trpc.mjs';

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
        func: (input: any, signal?: AbortSignal) => Promise<any>;
    };
} = {};

const variables: {
    [name: string]: {
        value: any;
        type: z.ZodType;
    };
} = {};

export function setVariable(options: {
    name: string;
    value: any;
    type: z.ZodType;
}) {
    variables[options.name] = {
        value: options.value,
        type: options.type,
    };

    return () => {
        delete variables[options.name];
    };
}

export function unsetVariable(options: {name: string}) {
    delete variables[options.name];
}

export function registerFunction(options: {
    name: string;
    input: z.ZodType;
    output: z.ZodType;
    func: (input: any, signal?: AbortSignal) => Promise<any>;
}): () => void {
    functions[options.name] = {
        name: options.name,
        inputType: options.input,
        outputType: options.output,
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

    const funcObj: Record<string, (input: unknown) => Promise<unknown>> =
        Object.fromEntries(
            Object.entries(functions).map(([name, value]) => [
                name,
                async (input: unknown) => {
                    const parsed = value.inputType.parse(input);
                    return await value.func(parsed, signal);
                },
            ]),
        );

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

        const varSchema = z.object(
            Object.fromEntries(
                Object.entries(variables).map(([key, v]) => [key, v.type]),
            ),
        );
        const variablesObjectDefinition =
            await renderVariableInterface(varSchema);

        const context = Object.entries(globals.contextInformation).map(
            ([_key, value]) => ({
                title: value.title ?? undefined,
                content: value.content,
            }),
        );

        const funcNames = Object.keys(funcObj);
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
                response = await client.converse.converse.mutate(requestPayload);
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
                    const wrappedCode = [
                        `(async function({${funcNames.join(', ')}}, {variables, delay, console, abortSignal}) {`,
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

                    const varsObj = Object.fromEntries(
                        Object.entries(variables).map(([key, v]) => [
                            key,
                            v.value,
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

                    try {
                        const fn = (0, eval)(wrappedCode) as (
                            funcs: typeof funcObj,
                            ctx: {
                                variables: Record<string, unknown>;
                                delay: ReturnType<typeof makeDelay>;
                                console: typeof stubCons;
                                abortSignal: AbortSignal;
                            },
                        ) => Promise<void>;

                        await fn(funcObj, {
                            variables: varsObj,
                            delay: makeDelay(execSignal),
                            console: stubCons,
                            abortSignal: execSignal,
                        });

                        const executionResult = {
                            type: 'execution_result' as const,
                            execution_identifier: block.execution_identifier,
                            result: logs.join('\n'),
                            error: null,
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
                    } catch (err) {
                        const errorMessage =
                            err instanceof Error
                                ? `${err.name}: ${err.message}\n${err.stack}`
                                : String(err);

                        const executionResult = {
                            type: 'execution_result' as const,
                            execution_identifier: block.execution_identifier,
                            result: logs.join('\n'),
                            error: errorMessage,
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
                    } finally {
                        clearTimeout(timeout);
                        signal.removeEventListener('abort', onParentAbort);
                    }
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
            options?.onStatusChange?.(
                signal.aborted ? 'aborted' : 'completed',
            );
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
