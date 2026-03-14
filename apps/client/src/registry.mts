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
    contextByKey: Object.create(null) as Record<string, TContextEntry>,
};

const functions = Object.create(null) as Record<string, TRegisteredFunction>;

const createConversationId = () => crypto.randomUUID();

let currentConversationId = createConversationId();
let activeRunController: AbortController | null = null;

export const getFunctionEntries = (): Array<[string, TRegisteredFunction]> =>
    Object.entries(functions);

export const registerFunction = (options: {
    name: string;
    input: z.ZodType;
    output: z.ZodType;
    mutates?: readonly string[];
    mutationTimeoutMs?: number;
    func: (input: unknown, signal?: AbortSignal) => Promise<unknown>;
}): (() => void) => {
    functions[options.name] = {
        name: options.name,
        inputType: options.input,
        outputType: options.output,
        mutates: options.mutates,
        mutationTimeoutMs: options.mutationTimeoutMs,
        func: options.func,
    };

    return () => {
        delete functions[options.name];
    };
};

export const unregisterFunction = (options: {name: string}): void => {
    delete functions[options.name];
};

export const setSystemPrompt = (prompt: string): void => {
    config.systemPrompt = prompt;
};

export const getSystemPrompt = (): string => config.systemPrompt;

export const setContextInformation = (
    key: string,
    options: TContextEntry,
): (() => void) => {
    config.contextByKey[key] = options;

    return () => {
        delete config.contextByKey[key];
    };
};

export const unsetContextInformation = (key: string): void => {
    delete config.contextByKey[key];
};

export const getContextEntries = (): TContextEntry[] =>
    Object.values(config.contextByKey);

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
