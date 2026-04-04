// Function registry: Zod-typed functions that the AI can invoke during
// conversations. Each function is registered with input/output schemas and
// optional mutation declarations.

import {z} from 'zod';

import {validateName} from './validate-name.mjs';

type TRegisteredFunction = {
    readonly name: string;
    readonly inputType: z.ZodType;
    readonly outputType: z.ZodType;
    readonly mutates?: readonly string[];
    readonly mutationTimeoutMs?: number;
    readonly func: (input: unknown, signal?: AbortSignal) => Promise<unknown>;
};

// Object.create(null) avoids prototype key collisions when function
// names could match Object.prototype properties like "constructor".
const functions = Object.create(null) as Record<string, TRegisteredFunction>;

export const getFunctionEntries = (): Array<[string, TRegisteredFunction]> =>
    Object.entries(functions);

export type TFunctionOptions<
    TInput extends z.ZodType = z.ZodType,
    TOutput extends z.ZodType = z.ZodVoid,
> = {
    readonly inputSchema: TInput;
    readonly outputSchema?: TOutput;
    readonly mutates?: readonly string[];
    readonly mutationTimeoutMs?: number;
    readonly func: (
        input: z.infer<TInput>,
        signal?: AbortSignal,
    ) => Promise<z.infer<TOutput>> | z.infer<TOutput>;
};

// Returns a cleanup function (disposer pattern) — useful in React useEffect
// to auto-unregister when a component unmounts.
export const registerFunction = <
    TInput extends z.ZodType,
    TOutput extends z.ZodType = z.ZodVoid,
>(
    name: string,
    options: TFunctionOptions<TInput, TOutput>,
): (() => void) => {
    validateName(name);

    functions[name] = {
        name: name,
        inputType: options.inputSchema,
        outputType: options.outputSchema ?? z.void(),
        mutates: options.mutates,
        mutationTimeoutMs: options.mutationTimeoutMs,
        func: async (input, signal) =>
            await options.func(input as z.infer<TInput>, signal),
    };

    return () => {
        delete functions[name];
    };
};

export const unregisterFunction = (name: string): void => {
    delete functions[name];
};

export type {TRegisteredFunction};
