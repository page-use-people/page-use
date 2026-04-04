import type {
    TPageUseChatExpandedPlacement,
    TPageUseChatRoundedness,
    TPageUseChatTheme,
} from '../types.js';

export const PANEL_GAP = 24;
export const LAUNCHER_BAR_MAX_WIDTH = 300;
export const DEFAULT_WIDTH = 320;
export const DEFAULT_HEIGHT = 560;
export const AUTO_SCROLL_THRESHOLD = 40;
export const SCROLL_SETTLE_MS = 100;

export const THEME_PALETTES = {
    dark: {
        background: '#222222',
        foreground: '#EEEEEE',
        surface: '#444444',
        muted: '#555555',
        divider: '#444444',
        accent: '#ff6a00',
        shadow: '0 25px 60px rgba(0,0,0,0.6)',
    },
    light: {
        background: '#f5f5f5',
        foreground: '#1c1c1c',
        surface: '#e8e8e8',
        muted: '#909090',
        divider: '#d0d0d0',
        accent: '#ff6a00',
        shadow: '0 8px 30px rgba(0,0,0,0.12)',
    },
} as const satisfies Record<
    TPageUseChatTheme,
    {
        readonly background: string;
        readonly foreground: string;
        readonly surface: string;
        readonly muted: string;
        readonly divider: string;
        readonly accent: string;
        readonly shadow: string;
    }
>;

export type TPageUseChatPalette = (typeof THEME_PALETTES)[TPageUseChatTheme];

export const ROUNDEDNESS_SCALES = {
    none: {sm: '0px', md: '0px', lg: '0px'},
    sm: {sm: '2px', md: '4px', lg: '6px'},
    md: {sm: '4px', md: '8px', lg: '12px'},
    lg: {sm: '6px', md: '12px', lg: '16px'},
    xl: {sm: '9999px', md: '16px', lg: '24px'},
} as const satisfies Record<
    TPageUseChatRoundedness,
    {readonly sm: string; readonly md: string; readonly lg: string}
>;

export type TPageUseChatRadii =
    (typeof ROUNDEDNESS_SCALES)[TPageUseChatRoundedness];

const clamp = (value: number, min: number, max: number) =>
    Math.min(Math.max(value, min), max);

export const clampPosition = (
    x: number,
    y: number,
    width: number,
    height: number,
) => ({
    x: clamp(
        x,
        PANEL_GAP,
        Math.max(PANEL_GAP, window.innerWidth - width - PANEL_GAP),
    ),
    y: clamp(
        y,
        PANEL_GAP,
        Math.max(PANEL_GAP, window.innerHeight - height - PANEL_GAP),
    ),
});

export const getDefaultPosition = (
    width: number,
    height: number,
    placement: TPageUseChatExpandedPlacement = 'bottom-right',
) =>
    clampPosition(
        placement === 'bottom-left'
            ? PANEL_GAP
            : window.innerWidth - width - PANEL_GAP,
        window.innerHeight - height - PANEL_GAP,
        width,
        height,
    );

export const createId = () => crypto.randomUUID();

const formatVariableList = (variables: readonly string[]) =>
    variables.length === 1
        ? variables[0]
        : `${variables.slice(0, -1).join(', ')} and ${variables[variables.length - 1]}`;

export const formatVariableWaitLabel = (variables: readonly string[]) =>
    variables.length === 0 ? 'state' : formatVariableList(variables);
