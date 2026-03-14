import {z} from 'zod';
import {
    renderFunctionType,
    renderVariableInterface,
} from '#client/render-types.mjs';
import {createClient} from '#client/trpc.mjs';
import type {TRunUpdate} from '#client/run-types.mjs';
import {
    getContextInformationEntries,
    getConversationId,
    getRegisteredFunctionEntries,
    getSystemPrompt,
    resetConversation,
    type TRegisteredFunction,
} from '#client/runtime-state.mjs';
import {
    DEFAULT_VARIABLE_WAIT_TIMEOUT_MS,
    executeAssistantExecutionBlock,
} from '#client/execution-runtime.mjs';
import {
    getOrderedRegisteredVariableEntries,
    getVariableSnapshot,
    serializeVariableSnapshot,
} from '#client/variable-observer.mjs';

type TConversationRequestBlock =
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

const buildFunctionDescription = (
    registeredFunction: TRegisteredFunction,
): string => {
    const descriptionSegments = [registeredFunction.name];

    if ((registeredFunction.writes?.length ?? 0) > 0) {
        descriptionSegments.push(
            `Declared default waits: ${registeredFunction.writes?.join(', ')}.`,
        );
        descriptionSegments.push(
            typeof registeredFunction.mutationTimeoutMs === 'number'
                ? `Automatic wait timeout: ${registeredFunction.mutationTimeoutMs}ms.`
                : `Automatic wait timeout: ${DEFAULT_VARIABLE_WAIT_TIMEOUT_MS}ms by default.`,
        );
    }

    return descriptionSegments.join(' ');
};

const buildRenderedToolDefinitions = async (
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

const buildRenderedVariablesObjectDefinition = async (): Promise<string> =>
    await renderVariableInterface(
        z.object(
            Object.fromEntries(
                getOrderedRegisteredVariableEntries().map(
                    ([variableName, variableState]) => [
                        variableName,
                        variableState.type,
                    ],
                ),
            ),
        ),
    );

const buildConversationContext = (): Array<{
    title?: string;
    content: string;
}> => [
    ...getContextInformationEntries().map((contextEntry) => ({
        title: contextEntry.title ?? undefined,
        content: contextEntry.content,
    })),
    {
        title: 'current_variables',
        content: serializeVariableSnapshot(getVariableSnapshot()),
    },
];

export const isInvalidConversationHistoryError = (error: unknown): boolean =>
    String(error).includes(
        '`tool_use` ids were found without `tool_result` blocks immediately after',
    );

export const runConversationLoop = async (options: {
    userPrompt: string;
    signal: AbortSignal;
    onMessage?: (message: string) => void;
    onUpdate?: (update: TRunUpdate) => void;
}): Promise<void> => {
    const client = createClient();

    let conversationRequestBlocks: TConversationRequestBlock[] = [
        {type: 'text', message: options.userPrompt},
    ];
    let hasRetriedInvalidConversationHistory = false;

    while (!options.signal.aborted) {
        const registeredFunctionEntries = getRegisteredFunctionEntries();
        const renderedToolDefinitions = await buildRenderedToolDefinitions(
            registeredFunctionEntries,
        );
        const conversationRequestPayload = {
            conversation_id: getConversationId(),
            system_prompt: getSystemPrompt(),
            context: buildConversationContext(),
            available_tools: renderedToolDefinitions,
            variables_object_definition:
                await buildRenderedVariablesObjectDefinition(),
            blocks: conversationRequestBlocks,
        };
        const isInitialUserPrompt =
            conversationRequestBlocks.length === 1 &&
            conversationRequestBlocks[0]?.type === 'text' &&
            conversationRequestBlocks[0].message === options.userPrompt;

        let assistantResponse;

        try {
            console.log('PAGE_USE_REQUEST', conversationRequestPayload);
            assistantResponse = await client.converse.converse.mutate(
                conversationRequestPayload,
            );
        } catch (error) {
            if (
                isInitialUserPrompt &&
                !hasRetriedInvalidConversationHistory &&
                isInvalidConversationHistoryError(error)
            ) {
                resetConversation();
                hasRetriedInvalidConversationHistory = true;
                continue;
            }

            throw error;
        }

        const executionResultBlocks: TConversationRequestBlock[] = [];
        const assistantTextMessages: string[] = [];

        for (const assistantBlock of assistantResponse.blocks) {
            console.log('PAGE_USE_RESPONSE_BLOCK', assistantBlock);

            if (assistantBlock.type === 'text') {
                assistantTextMessages.push(assistantBlock.message);
                options.onUpdate?.({
                    type: 'text',
                    message: assistantBlock.message,
                });
                continue;
            }

            if (assistantBlock.type === 'thinking') {
                continue;
            }

            const executionResult = await executeAssistantExecutionBlock({
                block: {
                    executionIdentifier: assistantBlock.execution_identifier,
                    description: assistantBlock.description,
                    code: assistantBlock.code,
                },
                registeredFunctionEntries,
                parentAbortSignal: options.signal,
                onUpdate: options.onUpdate,
            });

            const executionResultBlock: TConversationRequestBlock = {
                type: 'execution_result',
                execution_identifier: assistantBlock.execution_identifier,
                result: executionResult.result,
                error: executionResult.error,
            };
            executionResultBlocks.push(executionResultBlock);
            console.log('PAGE_USE_EXECUTION_RESULT', {
                execution_identifier: executionResultBlock.execution_identifier,
                description: assistantBlock.description,
                result: executionResultBlock.result,
                error: executionResultBlock.error,
            });
            options.onUpdate?.({
                type: 'execution_result',
                executionIdentifier: executionResultBlock.execution_identifier,
                description: assistantBlock.description,
                result: executionResultBlock.result,
                error: executionResultBlock.error,
            });
        }

        if (executionResultBlocks.length === 0) {
            for (const assistantTextMessage of assistantTextMessages) {
                options.onMessage?.(assistantTextMessage);
            }

            return;
        }

        hasRetriedInvalidConversationHistory = false;
        conversationRequestBlocks = executionResultBlocks;
    }
};
