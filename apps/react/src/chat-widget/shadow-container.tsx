import {useEffect, useRef, useState, type CSSProperties, type ReactNode} from 'react';
import {createPortal} from 'react-dom';

import type {TPageUseChatPalette} from './shared.js';
import {twindTarget} from './twind.js';

type TShadowContainerProps = {
    readonly palette: TPageUseChatPalette;
    readonly children: ReactNode;
};

const paletteToVars = (palette: TPageUseChatPalette): CSSProperties =>
    ({
        '--pu-bg': palette.background,
        '--pu-fg': palette.foreground,
        '--pu-surface': palette.surface,
        '--pu-muted': palette.muted,
        '--pu-divider': palette.divider,
        '--pu-accent': palette.accent,
    }) as CSSProperties;

export const ShadowContainer = ({palette, children}: TShadowContainerProps) => {
    const hostRef = useRef<HTMLDivElement | null>(null);
    const [shadowRoot, setShadowRoot] = useState<ShadowRoot | null>(null);

    useEffect(() => {
        if (!hostRef.current) {
            return;
        }

        const shadow = hostRef.current.attachShadow({mode: 'open'});
        shadow.adoptedStyleSheets = [twindTarget];
        setShadowRoot(shadow);
    }, []);

    return (
        <div ref={hostRef}>
            {shadowRoot
                ? createPortal(
                      <div style={paletteToVars(palette)}>{children}</div>,
                      shadowRoot,
                  )
                : null}
        </div>
    );
};
