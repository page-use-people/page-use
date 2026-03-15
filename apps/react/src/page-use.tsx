import {useEffect, useRef} from 'react';
import {
    registerFunction,
    setSystemPrompt,
    setVariable,
    unsetVariable,
} from '@page-use/client';

import {z} from 'zod';

type TPageUseSystemPromptWithProp = {
    readonly prompt: string;
    readonly children?: never;
};

type TPageUseSystemPromptWithChildren = {
    readonly prompt?: never;
    readonly children: string;
};

export type TPageUseSystemPromptProps =
    | TPageUseSystemPromptWithProp
    | TPageUseSystemPromptWithChildren;

export const useSystemPrompt = (prompt: string): void => {
    useEffect(() => {
        setSystemPrompt(prompt);

        return () => {
            setSystemPrompt('');
        };
    }, [prompt]);
};

export const SystemPrompt = (props: TPageUseSystemPromptProps) => {
    useSystemPrompt((props.prompt ?? props.children) as string);
    return null;
};

export type TPageUseVariableOptions<TType extends z.ZodType = z.ZodType> = {
    schema: TType;
    value: z.infer<TType>;
};

export const useAgentVariable = <TType extends z.ZodType>(
    name: string,
    options: TPageUseVariableOptions,
): void => {
    useEffect(() => {
        setVariable({
            name: name,
            value: options.value,
            type: options.schema,
        });
    }, [name, options.schema, options.value]);

    useEffect(
        () => () => {
            unsetVariable({name: name});
        },
        [name],
    );
};

export type TPageUseFunctionOptions<
    TInput extends z.ZodType,
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

export const useAgentFunction = <
    TInput extends z.ZodType,
    TOutput extends z.ZodType = z.ZodVoid,
>(
    name: string,
    options: TPageUseFunctionOptions<TInput, TOutput>,
): void => {
    const funcRef = useRef(options.func);

    useEffect(() => {
        funcRef.current = options.func;
    }, [options.func]);

    useEffect(
        () =>
            registerFunction({
                name: name,
                input: options.inputSchema,
                output: options.outputSchema ?? z.void(),
                mutates: options.mutates,
                mutationTimeoutMs: options.mutationTimeoutMs,
                func: async (input, signal) =>
                    await funcRef.current(input as z.infer<TInput>, signal),
            }),
        [
            options.inputSchema,
            name,
            options.outputSchema,
            options.mutates,
            options.mutationTimeoutMs,
        ],
    );
};
