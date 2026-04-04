// Request payload building: assembles the data sent to the AI each turn,
// including rendered function signatures, variable types, and context entries.

import {z} from 'zod';

import {
    renderFunctionType,
    renderVariableInterface,
} from '#client/lib/type-renderer.mjs';
import type {TRegisteredFunction} from '#client/registry/functions.mjs';
import {
    getContextEntries,
    getConversationId,
    getSystemPrompt,
} from '#client/registry/context.mjs';
import {getRegisteredEntries} from '#client/registry/variables.mjs';

import {MUTATION_TIMEOUT_MS} from './executor.mjs';

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

export const renderToolDefinitions = async (
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

export const renderVariablesType = async (): Promise<string> =>
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
];

export const buildRequestPayload = async (
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

export type {TRequestBlock};
