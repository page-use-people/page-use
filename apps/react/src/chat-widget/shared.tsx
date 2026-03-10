import {memo} from 'react';

import type {TPageUseChatPrompt, TPageUseChatTheme} from './types.js';

export const PANEL_GAP = 24;
export const BUBBLE_SIZE = 84;
export const DEFAULT_WIDTH = 380;
export const DEFAULT_HEIGHT = 560;
export const AUTO_SCROLL_THRESHOLD = 40;

export const DEFAULT_PROMPTS: readonly TPageUseChatPrompt[] = [
    {
        label: 'What can you do?',
        prompt: 'What are you capable of on this page?',
    },
];

export const THEME_PALETTES = {
    dark: {
        background: '#000000',
        foreground: '#ffffff',
        surface: '#2e2e2e',
        muted: '#6d6d6d',
        divider: '#3d3d3d',
        accent: '#ff6a00',
    },
    light: {
        background: '#ffffff',
        foreground: '#000000',
        surface: '#e7e7e7',
        muted: '#6d6d6d',
        divider: '#c9c9c9',
        accent: '#ff6a00',
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
    }
>;

export type TPageUseChatPalette =
    (typeof THEME_PALETTES)[TPageUseChatTheme];

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

export const getBoxSize = (
    isOpen: boolean,
    width: number,
    height: number,
) => ({
    width: isOpen ? width : BUBBLE_SIZE,
    height: isOpen ? height : BUBBLE_SIZE,
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
