// Sandbox helpers for AI code execution: code wrapping, console capture,
// and error formatting. These are pure utilities with no execution-side effects.

type TSandboxConsole = {
    readonly log: (...args: unknown[]) => void;
    readonly error: (...args: unknown[]) => void;
    readonly info: (...args: unknown[]) => void;
};

// Errors get full stack traces; objects get JSON; everything else is stringified.
export const formatLoggedValue = (value: unknown): string => {
    if (value instanceof Error) {
        return `${value.name}: ${value.message}\n${value.stack}`;
    }

    if (typeof value === 'string') {
        return value;
    }

    const serializedValue = JSON.stringify(value);
    return serializedValue ?? String(value);
};

// All console methods (log/error/info) funnel to one appender — the AI sees
// captured output as a single stream, severity levels are not distinguished.
export const createSandboxConsole = (): [TSandboxConsole, string[]] => {
    const capturedLogLines: string[] = [];

    const appendLogLine = (...args: unknown[]) => {
        capturedLogLines.push(args.map(formatLoggedValue).join(' '));
        console.debug('LLM', ...args);
    };

    return [
        {
            log: appendLogLine,
            error: appendLogLine,
            info: appendLogLine,
        },
        capturedLogLines,
    ];
};

// Wraps the AI's code as an async IIFE with two destructured parameters:
// 1st arg = registered functions by name, 2nd arg = context utilities
// (variables, delay, animations, mutation waiter, console, abortSignal).
export const wrapCodeAsFunction = (
    availableFunctionNames: readonly string[],
    code: string,
): string =>
    [
        `(async function({${availableFunctionNames.join(', ')}}, {variables, delay, runInAnimationFrames, waitForMutation, console, abortSignal}) {`,
        code,
        '})',
    ].join('\n');

export const formatError = (error: unknown): string =>
    error instanceof Error
        ? `${error.name}: ${error.message}\n${error.stack}`
        : String(error);

export type {TSandboxConsole};
