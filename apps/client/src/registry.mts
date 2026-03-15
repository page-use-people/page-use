// Global registry for functions, system prompt, and context that the AI can
// access during conversations. Functions are registered with Zod schemas for
// type-safe I/O and optional mutation declarations. Only one conversation run
// is allowed at a time, enforced via the activeRunController mutex.

import dedent from 'dedent';
import {z} from 'zod';

type TContextEntry = {
    readonly title: string | null;
    readonly content: string;
};

type TRegisteredFunction = {
    readonly name: string;
    readonly inputType: z.ZodType;
    readonly outputType: z.ZodType;
    readonly mutates?: readonly string[];
    readonly mutationTimeoutMs?: number;
    readonly func: (input: unknown, signal?: AbortSignal) => Promise<unknown>;
};

const config = {
    systemPrompt: '',
    // Object.create(null) avoids prototype key collisions when context/function
    // names could match Object.prototype properties like "constructor".
    contextByKey: Object.create(null) as Record<string, TContextEntry>,
};

const functions = Object.create(null) as Record<string, TRegisteredFunction>;

const createConversationId = () => crypto.randomUUID();

let currentConversationId = createConversationId();
let activeRunController: AbortController | null = null;

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

export const setSystemPrompt = (prompt: string): void => {
    config.systemPrompt = dedent(prompt);
};

export const getSystemPrompt = (): string => config.systemPrompt;

export const setContextInformation = (
    key: string,
    options: TContextEntry,
): (() => void) => {
    config.contextByKey[key] = {...options, content: dedent(options.content)};

    return () => {
        delete config.contextByKey[key];
    };
};

export const unsetContextInformation = (key: string): void => {
    delete config.contextByKey[key];
};

export const getContextEntries = (): TContextEntry[] =>
    Object.values(config.contextByKey);

// Generates a new UUID so the server starts a fresh conversation history.
// Called after stale conversation errors to recover from dangling tool_use blocks.
export const resetConversation = (): void => {
    currentConversationId = createConversationId();
};

export const getConversationId = (): string => currentConversationId;

export const getActiveRunController = (): AbortController | null =>
    activeRunController;

export const setActiveRunController = (next: AbortController | null): void => {
    activeRunController = next;
};

export type {TContextEntry, TRegisteredFunction};
