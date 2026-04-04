import type {TProductTheme} from './catalog.ts';

export const hexToRGBA = (hex: string, alpha: number) => {
    const n = parseInt(hex.replace('#', ''), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};

export const buildThumbStyle = (theme: TProductTheme): React.CSSProperties =>
    ({
        '--c-v': theme.vibrant,
        '--c-m': theme.muted,
        '--c-dv': theme.darkVibrant,
        '--c-dm': theme.darkMuted,
        '--c-lv': theme.lightVibrant,
        '--c-lm': theme.lightMuted,
        '--c-shell': hexToRGBA(theme.lightMuted, 0.18),
        backgroundImage:
            'radial-gradient(circle at top, rgba(255, 255, 255, 0.8), transparent 56%), linear-gradient(180deg, color-mix(in srgb, var(--c-lv) 38%, rgba(248, 241, 233, 0.98)), color-mix(in srgb, var(--c-shell) 18%, rgba(243, 235, 226, 0.94)))',
    }) as React.CSSProperties;
