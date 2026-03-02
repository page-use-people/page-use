import {z} from 'zod';
import {
    renderFunctionType,
    renderVariableInterface,
} from '#client/render-types.mjs';

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

export function stubConsole() {
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

export function run(userPrompt: string) {
    const abortController = new AbortController();

    const delay = makeDelay(abortController.signal);

    const [console, logs] = stubConsole();

    const _vars = Object.entries(variables).map(([key, value]) => [
        key,
        value.value,
    ]);

    const _func = Object.entries(functions).map(([name, value]) => [
        name,
        async (input: any, signal: AbortSignal) => {
            const inputParameter = value.inputType.parse(input);
            return await value.func(inputParameter, signal);
        },
    ]);
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
