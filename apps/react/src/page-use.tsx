import {useEffect, useRef} from 'react';
import {
    registerFunction,
    setSystemPrompt,
    setVariable,
} from '@page-use/client';
import {z} from 'zod';

export type TPageUseSystemPromptProps = {
    readonly prompt: string;
};

export const usePageUseSystemPrompt = (prompt: string): void => {
    useEffect(() => {
        setSystemPrompt(prompt);

        return () => {
            setSystemPrompt('');
        };
    }, [prompt]);
};

export const PageUseSystemPrompt = ({
    prompt,
}: TPageUseSystemPromptProps) => {
    usePageUseSystemPrompt(prompt);
    return null;
};

export type TPageUseVariableOptions<TType extends z.ZodType = z.ZodType> = {
    readonly name: string;
    readonly value: z.infer<TType>;
    readonly type: TType;
};

export const usePageUseVariable = <TType extends z.ZodType>(
    options: TPageUseVariableOptions<TType>,
): void => {
    useEffect(
        () =>
            setVariable({
                name: options.name,
                value: options.value,
                type: options.type,
            }),
        [options.name, options.type, options.value],
    );
};

export const PageUseVariable = <TType extends z.ZodType>(
    options: TPageUseVariableOptions<TType>,
) => {
    usePageUseVariable(options);
    return null;
};

export type TPageUseFunctionOptions<
    TInput extends z.ZodType = z.ZodType,
    TOutput extends z.ZodType = z.ZodType,
> = {
    readonly name: string;
    readonly input: TInput;
    readonly output: TOutput;
    readonly func: (
        input: z.infer<TInput>,
        signal?: AbortSignal,
    ) => Promise<z.infer<TOutput>> | z.infer<TOutput>;
};

export const usePageUseFunction = <
    TInput extends z.ZodType,
    TOutput extends z.ZodType,
>(
    options: TPageUseFunctionOptions<TInput, TOutput>,
): void => {
    const funcRef = useRef(options.func);

    useEffect(() => {
        funcRef.current = options.func;
    }, [options.func]);

    useEffect(
        () =>
            registerFunction({
                name: options.name,
                input: options.input,
                output: options.output,
                func: async (input, signal) =>
                    await funcRef.current(input as z.infer<TInput>, signal),
            }),
        [options.input, options.name, options.output],
    );
};

export const PageUseFunction = <
    TInput extends z.ZodType,
    TOutput extends z.ZodType,
>(
    options: TPageUseFunctionOptions<TInput, TOutput>,
) => {
    usePageUseFunction(options);
    return null;
};
