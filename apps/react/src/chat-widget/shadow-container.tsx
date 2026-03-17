import {useEffect, useRef, useState, type CSSProperties, type ReactNode} from 'react';
import {createPortal} from 'react-dom';

import {markdownStyles} from './markdown.js';
import {twindTarget, scrollbarStyles} from './twind.js';

type TShadowContainerProps = {
    readonly cssVariables: Record<string, string>;
    readonly children: ReactNode;
};

export const ShadowContainer = ({cssVariables, children}: TShadowContainerProps) => {
    const hostRef = useRef<HTMLDivElement | null>(null);
    const [shadowRoot, setShadowRoot] = useState<ShadowRoot | null>(null);

    useEffect(() => {
        if (!hostRef.current) {
            return;
        }

        const shadow = hostRef.current.attachShadow({mode: 'open'});
        shadow.adoptedStyleSheets = [twindTarget, scrollbarStyles, markdownStyles];
        setShadowRoot(shadow);
    }, []);

    return (
        <div ref={hostRef}>
            {shadowRoot
                ? createPortal(
                      <div style={cssVariables as CSSProperties}>{children}</div>,
                      shadowRoot,
                  )
                : null}
        </div>
    );
};
