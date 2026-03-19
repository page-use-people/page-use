import {useRef, useState, useEffect} from 'react';
import {Reaction} from 'mobx';

type TComponentFn<P> = ((props: P) => React.ReactElement | null) & {
    displayName?: string;
};

export const observer = <P extends Record<string, unknown>>(
    component: TComponentFn<P>,
): TComponentFn<P> => {
    const wrapped: TComponentFn<P> = (props: P) => {
        const [, forceRender] = useState(0);
        const reactionRef = useRef<Reaction | null>(null);

        if (!reactionRef.current) {
            reactionRef.current = new Reaction(
                `observer(${component.displayName ?? component.name})`,
                () => forceRender((version) => version + 1),
            );
        }

        useEffect(() => () => reactionRef.current?.dispose(), []);

        let rendering: React.ReactElement | null = null;
        reactionRef.current.track(() => {
            rendering = component(props);
        });
        return rendering;
    };

    wrapped.displayName = `Observer(${component.displayName ?? component.name})`;
    return wrapped;
};
