// Animation frame loop with easing functions, exposed to sandbox code for smooth
// UI transitions. The signal is captured in a closure so all animations from one
// code execution share the same abort controller.

type TEasingName =
    | 'linear'
    | 'easeInQuad'
    | 'easeOutQuad'
    | 'easeInOutQuad'
    | 'easeInCubic'
    | 'easeOutCubic'
    | 'easeInOutCubic'
    | 'easeOutBack';

type TEasingFn = (t: number) => number;

type TAnimationOptions = {
    readonly from: number;
    readonly to: number;
    readonly duration: number;
    readonly easing?: TEasingName;
};

type TAnimationCallback = (value: number, progress: number) => void;

type TRunInAnimationFrames = (
    options: TAnimationOptions,
    callback: TAnimationCallback,
) => Promise<void>;

const EASING_FUNCTIONS: Readonly<Record<TEasingName, TEasingFn>> =
    Object.freeze({
        linear: (t: number) => t,
        easeInQuad: (t: number) => t * t,
        easeOutQuad: (t: number) => t * (2 - t),
        easeInOutQuad: (t: number) =>
            t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
        easeInCubic: (t: number) => t * t * t,
        easeOutCubic: (t: number) => 1 - Math.pow(1 - t, 3),
        easeInOutCubic: (t: number) =>
            t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
        // c1 (1.70158) is the standard overshoot constant from Penner's easing
        // equations — it controls how far the animation overshoots before settling.
        easeOutBack: (t: number) => {
            const c1 = 1.70158;
            const c3 = c1 + 1;
            return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
        },
    });

// Linear interpolation: blends between `from` and `to` by factor `t` (0..1).
const lerp = (from: number, to: number, t: number): number =>
    from + (to - from) * t;

export const makeRunInAnimationFrames = (
    signal: AbortSignal,
): TRunInAnimationFrames => {
    return (options: TAnimationOptions, callback: TAnimationCallback) =>
        new Promise<void>((resolve, reject) => {
            const easingFn =
                EASING_FUNCTIONS[options.easing ?? 'easeInOutCubic'];
            const startTime = performance.now();

            const onAbort = () => {
                reject(signal.reason);
            };

            signal.addEventListener('abort', onAbort, {once: true});

            const step = (now: number) => {
                if (signal.aborted) {
                    return;
                }

                const elapsed = now - startTime;
                const rawProgress = Math.min(elapsed / options.duration, 1);
                const easedProgress = easingFn(rawProgress);
                const value = lerp(options.from, options.to, easedProgress);

                callback(value, easedProgress);

                if (rawProgress < 1) {
                    requestAnimationFrame(step);
                } else {
                    signal.removeEventListener('abort', onAbort);
                    resolve();
                }
            };

            requestAnimationFrame(step);
        });
};

export type {
    TEasingName,
    TAnimationOptions,
    TAnimationCallback,
    TRunInAnimationFrames,
};
