import {greet} from '@page-use/client';

type TGreetingProps = {
    readonly name: string;
};

export const Greeting = ({name}: TGreetingProps) => {
    const {message} = greet(name);

    return <div>{message}</div>;
};

export type {TGreetingProps};
