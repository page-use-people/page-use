import {z} from 'zod';

type TContextInformationEntry = {
    readonly title: string | null;
    readonly content: string;
};

type TRegisteredFunction = {
    readonly name: string;
    readonly inputType: z.ZodType;
    readonly outputType: z.ZodType;
    readonly writes?: readonly string[];
    readonly mutationTimeoutMs?: number;
    readonly func: (input: unknown, signal?: AbortSignal) => Promise<unknown>;
};

const runtimeConfiguration = {
    systemPrompt: '',
    contextInformationByKey: Object.create(null) as Record<
        string,
        TContextInformationEntry
    >,
};

const registeredFunctionsByName = Object.create(null) as Record<
    string,
    TRegisteredFunction
>;

const createConversationId = () => crypto.randomUUID();

let currentConversationId = createConversationId();
let activeRunController: AbortController | null = null;

export const getRegisteredFunctionEntries = (): Array<
    [string, TRegisteredFunction]
> => Object.entries(registeredFunctionsByName);

export const registerFunction = (options: {
    name: string;
    input: z.ZodType;
    output: z.ZodType;
    writes?: readonly string[];
    mutationTimeoutMs?: number;
    func: (input: unknown, signal?: AbortSignal) => Promise<unknown>;
}): (() => void) => {
    registeredFunctionsByName[options.name] = {
        name: options.name,
        inputType: options.input,
        outputType: options.output,
        writes: options.writes,
        mutationTimeoutMs: options.mutationTimeoutMs,
        func: options.func,
    };

    return () => {
        delete registeredFunctionsByName[options.name];
    };
};

export const unregisterFunction = (options: {name: string}): void => {
    delete registeredFunctionsByName[options.name];
};

export const setSystemPrompt = (prompt: string): void => {
    runtimeConfiguration.systemPrompt = prompt;
};

export const getSystemPrompt = (): string => runtimeConfiguration.systemPrompt;

export const setContextInformation = (
    key: string,
    options: TContextInformationEntry,
): (() => void) => {
    runtimeConfiguration.contextInformationByKey[key] = options;

    return () => {
        delete runtimeConfiguration.contextInformationByKey[key];
    };
};

export const unsetContextInformation = (key: string): void => {
    delete runtimeConfiguration.contextInformationByKey[key];
};

export const getContextInformationEntries = (): TContextInformationEntry[] =>
    Object.values(runtimeConfiguration.contextInformationByKey);

export const resetConversation = (): void => {
    currentConversationId = createConversationId();
};

export const getConversationId = (): string => currentConversationId;

export const getActiveRunController = (): AbortController | null =>
    activeRunController;

export const setActiveRunController = (
    nextActiveRunController: AbortController | null,
): void => {
    activeRunController = nextActiveRunController;
};

export type {TContextInformationEntry, TRegisteredFunction};
