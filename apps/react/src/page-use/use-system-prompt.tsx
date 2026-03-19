import {useEffect} from 'react';
import {setSystemPrompt} from '@page-use/client';

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
