// Reactive variable store with version-tracked change detection and debounced
// mutation waiting. Each variable has a monotonic version number that increments
// only on actual value changes (via Object.is). Mutation waiters use a debounce
// algorithm: after observing a change, wait for a quiet period with no further
// changes before resolving — this batches burst updates (e.g. rapid React re-renders).

import {z} from 'zod';

type TRegisteredVariable = {
    readonly value: unknown;
    readonly type: z.ZodType;
    readonly version: number;
};

type TVariableWaitResult = {
    readonly status: 'updated' | 'timeout';
    readonly variables: string[];
};

// Object.create(null) produces prototype-free objects, avoiding key collisions
// with Object.prototype (e.g. "toString", "constructor") when variable names
// come from user-defined application state.
const registeredVariables = Object.create(null) as Record<
    string,
    TRegisteredVariable
>;

// One-shot waiter sets: each callback fires once on the next version bump for
// that variable, then the set is cleared. New waits must re-register.
const updateWaiters = Object.create(null) as Record<
    string,
    Set<(nextVersion: number) => void>
>;

// After observing a change, wait this many ms of silence before resolving.
// This debounces burst updates (e.g. multiple React state changes in one tick)
// into a single "mutations settled" signal.
export const MUTATION_QUIET_MS = 100;

// Sorted alphabetically so the AI sees a stable ordering in its prompt,
// regardless of registration order.
export const getRegisteredEntries = (): Array<[string, TRegisteredVariable]> =>
    Object.entries(registeredVariables).sort(([left], [right]) =>
        left.localeCompare(right),
    );

export const getVariableVersion = (name: string): number =>
    registeredVariables[name]?.version ?? 0;

export const getVersionSnapshot = (): Record<string, number> =>
    Object.fromEntries(
        getRegisteredEntries().map(([name, state]) => [name, state.version]),
    );

export const getVersionSnapshotFor = (
    variableNames: readonly string[],
): Record<string, number> =>
    Object.fromEntries(
        variableNames.map((name) => [name, getVariableVersion(name)]),
    );

const findChanged = (baselineVersions: Record<string, number>): string[] =>
    Object.entries(baselineVersions)
        .filter(([name, baseline]) => getVariableVersion(name) > baseline)
        .map(([name]) => name);

const notifyWaiters = (variableName: string, nextVersion: number): void => {
    const waiters = updateWaiters[variableName];
    if (!waiters) {
        return;
    }

    for (const waiter of waiters) {
        waiter(nextVersion);
    }

    waiters.clear();
};

// Low-level primitive: resolves as soon as any watched variable's version
// exceeds its baseline, or on timeout/abort. The `hasSettled` guard prevents
// double-resolve from racing timeout/abort/update, and cleanup callbacks
// remove listeners to prevent memory leaks.
const waitForAnyUpdate = (
    baselineVersions: Record<string, number>,
    signal: AbortSignal,
    timeoutMs?: number,
): Promise<TVariableWaitResult> => {
    const watchedNames = Object.keys(baselineVersions);
    if (watchedNames.length === 0) {
        return Promise.resolve({status: 'timeout', variables: []});
    }

    const alreadyChanged = findChanged(baselineVersions);
    if (alreadyChanged.length > 0) {
        return Promise.resolve({
            status: 'updated',
            variables: alreadyChanged,
        });
    }

    return new Promise((resolve, reject) => {
        signal.throwIfAborted();

        const cleanupCallbacks: Array<() => void> = [];
        let hasSettled = false;
        let timeoutId: ReturnType<typeof setTimeout> | null = null;

        const settle = (outcome: 'updated' | 'timeout' | 'aborted') => {
            if (hasSettled) {
                return;
            }

            hasSettled = true;
            if (timeoutId !== null) {
                clearTimeout(timeoutId);
            }
            signal.removeEventListener('abort', onAbort);
            cleanupCallbacks.forEach((fn) => fn());

            outcome === 'aborted'
                ? reject(signal.reason)
                : resolve({
                      status: outcome,
                      variables:
                          outcome === 'updated'
                              ? findChanged(baselineVersions)
                              : [],
                  });
        };

        const onAbort = () => settle('aborted');

        signal.addEventListener('abort', onAbort, {once: true});

        if (typeof timeoutMs === 'number') {
            timeoutId = setTimeout(() => settle('timeout'), timeoutMs);
        }

        for (const watchedName of watchedNames) {
            const waiters = updateWaiters[watchedName] ?? new Set();
            updateWaiters[watchedName] = waiters;

            const handleVersion = (nextVersion: number) => {
                if (nextVersion <= (baselineVersions[watchedName] ?? 0)) {
                    return;
                }

                settle('updated');
            };

            waiters.add(handleVersion);
            cleanupCallbacks.push(() => {
                waiters.delete(handleVersion);

                if (waiters.size === 0) {
                    delete updateWaiters[watchedName];
                }
            });
        }
    });
};

const getRemainingTimeoutMs = (
    deadlineTimestampMs?: number,
): number | undefined => {
    if (typeof deadlineTimestampMs !== 'number') {
        return undefined;
    }

    return Math.max(0, deadlineTimestampMs - Date.now());
};

// Debounced mutation wait algorithm:
// 1. First iteration waits indefinitely (or until the overall deadline).
// 2. Once a change is observed, subsequent iterations use `quietMs` as a short
//    window to catch more changes in the same burst.
// 3. Resolves when a quiet window passes with no new changes, or on timeout.
// This ensures burst updates (e.g. multiple setState calls) are captured together.
export const waitForMutations = async (options: {
    baselineVersions: Record<string, number>;
    signal: AbortSignal;
    quietMs: number;
    timeoutMs?: number;
}): Promise<TVariableWaitResult> => {
    const watchedNames = Object.keys(options.baselineVersions);
    if (watchedNames.length === 0) {
        return {status: 'timeout', variables: []};
    }

    const observedNames = new Set<string>();
    const deadlineTimestampMs =
        typeof options.timeoutMs === 'number'
            ? Date.now() + options.timeoutMs
            : undefined;
    let currentBaseline = options.baselineVersions;

    while (true) {
        const remainingMs = getRemainingTimeoutMs(deadlineTimestampMs);
        if (remainingMs === 0) {
            return {
                status: 'timeout',
                variables: watchedNames.filter((name) =>
                    observedNames.has(name),
                ),
            };
        }

        const nextWaitTimeoutMs =
            observedNames.size > 0
                ? remainingMs === undefined
                    ? options.quietMs
                    : Math.min(options.quietMs, remainingMs)
                : remainingMs;

        const result = await waitForAnyUpdate(
            currentBaseline,
            options.signal,
            nextWaitTimeoutMs,
        );

        for (const name of findChanged(currentBaseline)) {
            observedNames.add(name);
        }

        for (const name of result.variables) {
            observedNames.add(name);
        }

        if (result.status === 'timeout') {
            return {
                status: 'timeout',
                variables: watchedNames.filter((name) =>
                    observedNames.has(name),
                ),
            };
        }

        currentBaseline = getVersionSnapshotFor(watchedNames);
    }
};

export const getValueSnapshot = (): Record<string, unknown> =>
    Object.fromEntries(
        getRegisteredEntries().map(([name, state]) => [name, state.value]),
    );

// Custom JSON replacer handles values that don't serialize cleanly:
// Errors → {name, message, stack}, undefined → "[undefined]", functions → "[function]".
export const serializeSnapshot = (snapshot: Record<string, unknown>): string =>
    JSON.stringify(
        snapshot,
        (_key, value) => {
            if (value instanceof Error) {
                return {
                    name: value.name,
                    message: value.message,
                    stack: value.stack,
                };
            }

            if (typeof value === 'undefined') {
                return '[undefined]';
            }

            if (typeof value === 'function') {
                return '[function]';
            }

            return value;
        },
        2,
    );

// Read-only proxy over variable values. Getters return live values (not copies),
// and setters throw — this guides the AI toward using registered functions
// instead of directly mutating state.
export const createLiveProxy = (): Record<string, unknown> => {
    const liveVariables = Object.create(null) as Record<string, unknown>;

    for (const [name] of getRegisteredEntries()) {
        Object.defineProperty(liveVariables, name, {
            enumerable: true,
            configurable: false,
            get: () => registeredVariables[name]?.value,
            set: () => {
                throw new Error(
                    'The `variables` object is read-only. Use page functions to request state changes.',
                );
            },
        });
    }

    return Object.freeze(liveVariables);
};

export const ensureRegistered = (variableNames: readonly string[]): void => {
    const unknownNames = variableNames.filter(
        (name) => registeredVariables[name] === undefined,
    );

    if (unknownNames.length > 0) {
        throw new Error(`Unknown variable name(s): ${unknownNames.join(', ')}`);
    }
};

export type TVariableOptions<TType extends z.ZodType = z.ZodType> = {
    readonly schema: TType;
    readonly value: z.infer<TType>;
};

export const setVariable = <TType extends z.ZodType>(
    name: string,
    options: TVariableOptions<TType>,
): (() => void) => {
    const previous = registeredVariables[name];
    // Object.is comparison — version only advances on actual value changes,
    // preventing false-positive waiter notifications on no-op updates.
    const shouldAdvanceVersion =
        previous === undefined || !Object.is(previous.value, options.value);
    const nextVersion = shouldAdvanceVersion
        ? getVariableVersion(name) + 1
        : getVariableVersion(name);

    registeredVariables[name] = {
        value: options.value,
        type: options.schema,
        version: nextVersion,
    };

    if (shouldAdvanceVersion) {
        notifyWaiters(name, nextVersion);
    }

    return () => {
        unsetVariable(name);
    };
};

export const unsetVariable = (name: string): void => {
    delete registeredVariables[name];
    delete updateWaiters[name];
};
