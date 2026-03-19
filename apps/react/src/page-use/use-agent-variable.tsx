import {useEffect} from 'react';
import {setVariable, unsetVariable} from '@page-use/client';

import {z} from 'zod';

export type TPageUseVariableOptions<TType extends z.ZodType = z.ZodType> = {
    schema: TType;
    value: z.infer<TType>;
};

export const useAgentVariable = <TType extends z.ZodType>(
    name: string,
    options: TPageUseVariableOptions,
): void => {
    useEffect(() => {
        setVariable(name, {
            schema: options.schema,
            value: options.value,
        });
    }, [name, options.schema, options.value]);

    useEffect(
        () => () => {
            unsetVariable(name);
        },
        [name],
    );
};
