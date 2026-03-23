// System prompt, context information, conversation state, and run controller.
// The system prompt and context entries are sent to the AI in each request.
// The conversation ID tracks the current session; the run controller is a
// mutex ensuring only one conversation runs at a time.

import dedent from 'dedent';

import {validateName} from './validate-name.mjs';

type TContextEntry = {
    readonly title: string | null;
    readonly content: string;
};

const config = {
    systemPrompt: '',
    // Object.create(null) avoids prototype key collisions when context
    // names could match Object.prototype properties like "constructor".
    contextByKey: Object.create(null) as Record<string, TContextEntry>,
};

const createConversationId = () => crypto.randomUUID();

let currentConversationId = createConversationId();
let activeRunController: AbortController | null = null;

export const setSystemPrompt = (prompt: string): void => {
    config.systemPrompt = dedent(prompt);
};

export const getSystemPrompt = (): string => config.systemPrompt;

export const setContextInformation = (
    key: string,
    options: TContextEntry,
): (() => void) => {
    validateName(key);

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

export type {TContextEntry};
