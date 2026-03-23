import {useEffect, useRef} from 'react';
import {registerFunction} from '@page-use/client';

import {z} from '@page-use/client';

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
            registerFunction(name, {
                inputSchema: options.inputSchema,
                outputSchema: options.outputSchema,
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
