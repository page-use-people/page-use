import {z} from '@page-use/client';

import {useAgentVariable} from './use-agent-variable.js';
import {useAgentFunction} from './use-agent-function.js';

export type TPageUseStateOptions<TType extends z.ZodType = z.ZodType> = {
    readonly schema: TType;
    readonly mutationTimeoutMs?: number;
};

const capitalize = (s: string): string =>
    s.charAt(0).toUpperCase() + s.slice(1);

export const useAgentState = <TType extends z.ZodType>(
    name: string,
    [state, setState]: [z.infer<TType>, (value: z.infer<TType>) => void],
    options: TPageUseStateOptions<TType>,
): [z.infer<TType>, (value: z.infer<TType>) => void] => {
    useAgentVariable(name, {
        schema: options.schema,
        value: state,
    });

    useAgentFunction(`set${capitalize(name)}`, {
        inputSchema: options.schema,
        mutates: [name],
        mutationTimeoutMs: options.mutationTimeoutMs,
        func: (input) => {
            setState(input);
        },
    });

    return [state, setState];
};
