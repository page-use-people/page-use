import {memo} from 'react';

import type {TPageUseChatRoundedness, TPageUseChatTheme} from './types.js';

export const PANEL_GAP = 24;
export const LAUNCHER_BAR_MAX_WIDTH = 300;
export const DEFAULT_WIDTH = 320;
export const DEFAULT_HEIGHT = 560;
export const AUTO_SCROLL_THRESHOLD = 40;

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

export const getDefaultPosition = (width: number, height: number) =>
    clampPosition(
        window.innerWidth - width - PANEL_GAP,
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

export const PageUseLogo = memo(
    ({
        frameColor,
        accentColor,
        size,
    }: {
        readonly frameColor: string;
        readonly accentColor: string;
        readonly size: number;
    }) => (
        <svg
            aria-hidden="true"
            viewBox="0 0 64 64"
            width={size}
            height={size}
            fill="none">
            <path
                d="M18 6H39L50 17V54C50 56.2091 48.2091 58 46 58H18C15.7909 58 14 56.2091 14 54V10C14 7.79086 15.7909 6 18 6Z"
                stroke={frameColor}
                strokeWidth="3"
                strokeLinejoin="round"
            />
            <path
                d="M39 6V17H50"
                stroke={frameColor}
                strokeWidth="3"
                strokeLinejoin="round"
            />
            {[0, 45, 90, 135].map((rotation) => (
                <path
                    key={rotation}
                    d="M32 18C36.5 22 41.5 22.5 46 32C41.5 41.5 36.5 42 32 46C27.5 42 22.5 41.5 18 32C22.5 22.5 27.5 22 32 18Z"
                    stroke={accentColor}
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    transform={`rotate(${rotation} 32 32)`}
                />
            ))}
        </svg>
    ),
);

PageUseLogo.displayName = 'PageUseLogo';
