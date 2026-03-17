import {useEffect, useRef, useState, type ComponentType, type CSSProperties, type ReactNode} from 'react';
import {createPortal} from 'react-dom';

import {markdownStyles} from './markdown.js';
import {twindTarget, scrollbarStyles} from './twind.js';

type TIconComponent = ComponentType<{readonly location: 'launcher' | 'panel'}>;

type TShadowContainerProps = {
    readonly cssVariables: Record<string, string>;
    readonly children: ReactNode;
    readonly icon?: TIconComponent;
};

export const ShadowContainer = ({cssVariables, children, icon: Icon}: TShadowContainerProps) => {
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
            {Icon ? <span slot="icon-panel"><Icon location="panel" /></span> : null}
            {shadowRoot
                ? createPortal(
                      <div style={cssVariables as CSSProperties}>{children}</div>,
                      shadowRoot,
                  )
                : null}
        </div>
    );
};
