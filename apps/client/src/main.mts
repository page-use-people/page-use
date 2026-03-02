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
        console.log('LLM', ...args);
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

export function run(userPrompt: string): {abort: () => void} {
    const abortController = new AbortController();
    const signal = abortController.signal;
    const [stubCons, logs] = stubConsole();
    const client = createClient();
    const conversationId = crypto.randomUUID();

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

        while (!signal.aborted) {
            const response = await client.converse.converse.mutate({
                conversation_id: conversationId,
                system_prompt: globals.systemPrompt,
                context,
                available_tools: toolDefs,
                variables_object_definition: variablesObjectDefinition,
                blocks: currentBlocks,
            });

            const resultBlocks: TUserBlock[] = [];

            for (const block of response.blocks) {
                if (block.type === 'text') {
                    console.log(`AGENT: ${block.message}`);
                } else if (block.type === 'execution') {
                    const wrappedCode = [
                        `(async function({${funcNames.join(', ')}}, {variables, delay, console, abortSignal}) {`,
                        block.code,
                        '})',
                    ].join('\n');

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
                        () => execController.abort('execution timed out after 12s'),
                        12_000,
                    );
                    const onParentAbort = () => execController.abort(signal.reason);
                    signal.addEventListener('abort', onParentAbort, {once: true});

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

                        resultBlocks.push({
                            type: 'execution_result' as const,
                            execution_identifier: block.execution_identifier,
                            result: logs.join('\n'),
                            error: null,
                        });
                    } catch (err) {
                        const errorMessage =
                            err instanceof Error
                                ? `${err.name}: ${err.message}\n${err.stack}`
                                : String(err);

                        resultBlocks.push({
                            type: 'execution_result' as const,
                            execution_identifier: block.execution_identifier,
                            result: logs.join('\n'),
                            error: errorMessage,
                        });
                    } finally {
                        clearTimeout(timeout);
                        signal.removeEventListener('abort', onParentAbort);
                    }
                }
            }

            if (resultBlocks.length === 0) {
                break;
            }

            currentBlocks = resultBlocks;
        }
    };

    loop().catch((err) => {
        console.error('run loop error:', err);
    });

    return {abort: () => abortController.abort()};
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
