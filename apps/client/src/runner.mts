// Conversation loop that sends prompts to the AI, executes returned code blocks,
// and feeds results back until the AI responds with text only (no code). Each
// iteration re-renders function types and variable state since they may change
// between turns. Only one conversation can run at a time (single-run lock).

import {z} from 'zod';
import {
    renderFunctionType,
    renderVariableInterface,
} from '#client/type-renderer.mjs';
import {createClient} from '#client/trpc.mjs';
import type {TRunUpdate, TRunHandle, TRunOptions} from '#client/types.mjs';
import {
    getContextEntries,
    getConversationId,
    getFunctionEntries,
    getSystemPrompt,
    resetConversation,
    getActiveRunController,
    setActiveRunController,
    type TRegisteredFunction,
} from '#client/registry.mjs';
import {MUTATION_TIMEOUT_MS, executeCodeBlock} from '#client/code-executor.mjs';
import {
    getRegisteredEntries,
    getValueSnapshot,
    serializeSnapshot,
} from '#client/variables.mjs';

type TRequestBlock =
    | {
          readonly type: 'text';
          readonly message: string;
      }
    | {
          readonly type: 'execution_result';
          readonly execution_identifier: string;
          readonly result: string;
          readonly error: string | null;
      };

// Produces the natural-language metadata the AI sees alongside each function's
// type signature — includes mutation declarations and timeout info.
const buildFunctionDescription = (
    registeredFunction: TRegisteredFunction,
): string => {
    const segments = [registeredFunction.name];

    if ((registeredFunction.mutates?.length ?? 0) > 0) {
        segments.push(
            `Declared default waits: ${registeredFunction.mutates?.join(', ')}.`,
        );
        segments.push(
            typeof registeredFunction.mutationTimeoutMs === 'number'
                ? `Automatic wait timeout: ${registeredFunction.mutationTimeoutMs}ms.`
                : `Automatic wait timeout: ${MUTATION_TIMEOUT_MS}ms by default.`,
        );
    }

    return segments.join(' ');
};

const renderToolDefinitions = async (
    registeredFunctionEntries: ReadonlyArray<[string, TRegisteredFunction]>,
): Promise<Array<{definition: string}>> =>
    await Promise.all(
        registeredFunctionEntries.map(
            async ([functionName, registeredFunction]) => ({
                definition: await renderFunctionType(
                    functionName,
                    registeredFunction.inputType,
                    registeredFunction.outputType,
                    buildFunctionDescription(registeredFunction),
                ),
            }),
        ),
    );

const renderVariablesType = async (): Promise<string> =>
    await renderVariableInterface(
        z.object(
            Object.fromEntries(
                getRegisteredEntries().map(([name, state]) => [
                    name,
                    state.type,
                ]),
            ),
        ),
    );

const buildConversationContext = (): Array<{
    title?: string;
    content: string;
}> => [
    ...getContextEntries().map((entry) => ({
        title: entry.title ?? undefined,
        content: entry.content,
    })),
    {
        title: 'current_variables',
        content: serializeSnapshot(getValueSnapshot()),
    },
];

const buildRequestPayload = async (
    requestBlocks: TRequestBlock[],
    registeredFunctionEntries: ReadonlyArray<[string, TRegisteredFunction]>,
) => ({
    conversation_id: getConversationId(),
    system_prompt: getSystemPrompt(),
    context: buildConversationContext(),
    available_tools: await renderToolDefinitions(registeredFunctionEntries),
    variables_object_definition: await renderVariablesType(),
    blocks: requestBlocks,
});

// If a prior run was aborted mid-execution, the server may have dangling
// tool_use blocks without matching results. This detects that specific
// Anthropic API error so the client can reset and start a fresh conversation.
const isStaleConversationError = (error: unknown): boolean =>
    String(error).includes(
        '`tool_use` ids were found without `tool_result` blocks immediately after',
    );

// Multi-turn conversation loop: sends the prompt + context to the AI, processes
// response blocks (text → collect, code → execute), feeds execution results back
// as the next request. The loop ends when the AI responds with text only.
const runConversationLoop = async (options: {
    userPrompt: string;
    signal: AbortSignal;
    onMessage?: (message: string) => void;
    onUpdate?: (update: TRunUpdate) => void;
}): Promise<void> => {
    const client = createClient();

    let requestBlocks: TRequestBlock[] = [
        {type: 'text', message: options.userPrompt},
    ];
    // One-retry limit prevents infinite loops on persistent stale state.
    let hasRetriedStaleConversation = false;

    while (!options.signal.aborted) {
        const registeredFunctionEntries = getFunctionEntries();
        const payload = await buildRequestPayload(
            requestBlocks,
            registeredFunctionEntries,
        );
        const isInitialPrompt =
            requestBlocks.length === 1 &&
            requestBlocks[0]?.type === 'text' &&
            requestBlocks[0].message === options.userPrompt;

        let assistantResponse;

        try {
            console.log('PAGE_USE_REQUEST', payload);
            assistantResponse = await client.converse.converse.mutate(payload);
        } catch (error) {
            if (
                isInitialPrompt &&
                !hasRetriedStaleConversation &&
                isStaleConversationError(error)
            ) {
                resetConversation();
                hasRetriedStaleConversation = true;
                continue;
            }

            throw error;
        }

        const executionResults: TRequestBlock[] = [];
        const textMessages: string[] = [];

        for (const block of assistantResponse.blocks) {
            console.log('PAGE_USE_RESPONSE_BLOCK', block);

            if (block.type === 'text') {
                textMessages.push(block.message);
                options.onUpdate?.({
                    type: 'text',
                    message: block.message,
                });
                continue;
            }

            if (block.type === 'thinking') {
                continue;
            }

            const result = await executeCodeBlock({
                block: {
                    executionIdentifier: block.execution_identifier,
                    description: block.description,
                    code: block.code,
                },
                registeredFunctionEntries,
                parentAbortSignal: options.signal,
                onUpdate: options.onUpdate,
            });

            executionResults.push({
                type: 'execution_result',
                execution_identifier: block.execution_identifier,
                result: result.result,
                error: result.error,
            });

            console.log('PAGE_USE_EXECUTION_RESULT', {
                execution_identifier: block.execution_identifier,
                description: block.description,
                result: result.result,
                error: result.error,
            });

            options.onUpdate?.({
                type: 'execution_result',
                executionIdentifier: block.execution_identifier,
                description: block.description,
                result: result.result,
                error: result.error,
            });
        }

        if (executionResults.length === 0) {
            textMessages.forEach((msg) => options.onMessage?.(msg));
            return;
        }

        hasRetriedStaleConversation = false;
        requestBlocks = executionResults;
    }
};

// Entry point: starts a conversation run. Only one run is allowed at a time —
// getActiveRunController() acts as a mutex. Returns a handle to abort or await.
export function run(userPrompt: string, options?: TRunOptions): TRunHandle {
    if (getActiveRunController() !== null) {
        throw new Error(
            'A Page Use response is already in progress. Wait for it to finish before sending another prompt.',
        );
    }

    const runAbortController = new AbortController();
    const runSignal = runAbortController.signal;
    setActiveRunController(runAbortController);
    options?.onStatusChange?.('running');

    const done = runConversationLoop({
        userPrompt,
        signal: runSignal,
        onMessage: options?.onMessage,
        onUpdate: options?.onUpdate,
    })
        .then(() => {
            options?.onStatusChange?.(
                runSignal.aborted ? 'aborted' : 'completed',
            );
        })
        .catch((error) => {
            if (runSignal.aborted) {
                options?.onStatusChange?.('aborted');
                return;
            }

            if (isStaleConversationError(error)) {
                resetConversation();
            }

            console.error('run loop error:', error);
            options?.onError?.(error);
            options?.onStatusChange?.('error');
        })
        .finally(() => {
            if (getActiveRunController() === runAbortController) {
                setActiveRunController(null);
            }
        });

    return {
        abort: () => runAbortController.abort(),
        done,
    };
}
