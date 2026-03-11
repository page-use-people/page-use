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

const registeredVariablesByName = Object.create(null) as Record<
    string,
    TRegisteredVariable
>;

const variableUpdateWaitersByName = Object.create(null) as Record<
    string,
    Set<(nextVersion: number) => void>
>;

export const VARIABLE_SETTLE_QUIET_PERIOD_MS = 50;

export const getOrderedRegisteredVariableEntries = (): Array<
    [string, TRegisteredVariable]
> =>
    Object.entries(registeredVariablesByName).sort(([left], [right]) =>
        left.localeCompare(right),
    );

export const getVariableVersion = (name: string): number =>
    registeredVariablesByName[name]?.version ?? 0;

export const getVariableVersionSnapshot = (): Record<string, number> =>
    Object.fromEntries(
        getOrderedRegisteredVariableEntries().map(([name, variableState]) => [
            name,
            variableState.version,
        ]),
    );

export const getVariableVersionSnapshotForNames = (
    variableNames: readonly string[],
): Record<string, number> =>
    Object.fromEntries(
        variableNames.map((variableName) => [
            variableName,
            getVariableVersion(variableName),
        ]),
    );

const getChangedVariableNames = (
    baselineVersions: Record<string, number>,
): string[] =>
    Object.entries(baselineVersions)
        .filter(
            ([variableName, baselineVersion]) =>
                getVariableVersion(variableName) > baselineVersion,
        )
        .map(([variableName]) => variableName);

const notifyVariableUpdateWaiters = (
    variableName: string,
    nextVersion: number,
): void => {
    const variableUpdateWaiters = variableUpdateWaitersByName[variableName];
    if (!variableUpdateWaiters) {
        return;
    }

    for (const variableUpdateWaiter of variableUpdateWaiters) {
        variableUpdateWaiter(nextVersion);
    }

    variableUpdateWaiters.clear();
};

const waitForAnyVariableUpdate = (
    baselineVersions: Record<string, number>,
    signal: AbortSignal,
    timeoutMs?: number,
): Promise<TVariableWaitResult> => {
    const watchedVariableNames = Object.keys(baselineVersions);
    if (watchedVariableNames.length === 0) {
        return Promise.resolve({status: 'timeout', variables: []});
    }

    const changedVariableNames = getChangedVariableNames(baselineVersions);
    if (changedVariableNames.length > 0) {
        return Promise.resolve({
            status: 'updated',
            variables: changedVariableNames,
        });
    }

    return new Promise((resolve, reject) => {
        if (signal.aborted) {
            reject(signal.reason);
            return;
        }

        const cleanupCallbacks: Array<() => void> = [];
        let hasSettled = false;
        let timeoutId: ReturnType<typeof setTimeout> | null = null;

        const finish = (status: 'updated' | 'timeout') => {
            if (hasSettled) {
                return;
            }

            hasSettled = true;
            if (timeoutId !== null) {
                clearTimeout(timeoutId);
            }
            signal.removeEventListener('abort', abortWaitForVariableUpdate);

            for (const cleanupCallback of cleanupCallbacks) {
                cleanupCallback();
            }

            resolve({
                status,
                variables:
                    status === 'updated'
                        ? getChangedVariableNames(baselineVersions)
                        : [],
            });
        };

        const abortWaitForVariableUpdate = () => {
            if (hasSettled) {
                return;
            }

            hasSettled = true;
            if (timeoutId !== null) {
                clearTimeout(timeoutId);
            }

            for (const cleanupCallback of cleanupCallbacks) {
                cleanupCallback();
            }

            signal.removeEventListener('abort', abortWaitForVariableUpdate);
            reject(signal.reason);
        };

        signal.addEventListener('abort', abortWaitForVariableUpdate, {
            once: true,
        });

        if (typeof timeoutMs === 'number') {
            timeoutId = setTimeout(() => finish('timeout'), timeoutMs);
        }

        for (const watchedVariableName of watchedVariableNames) {
            const variableUpdateWaiters =
                variableUpdateWaitersByName[watchedVariableName] ?? new Set();
            variableUpdateWaitersByName[watchedVariableName] =
                variableUpdateWaiters;

            const handleVariableVersion = (nextVersion: number) => {
                if (
                    nextVersion <= (baselineVersions[watchedVariableName] ?? 0)
                ) {
                    return;
                }

                finish('updated');
            };

            variableUpdateWaiters.add(handleVariableVersion);
            cleanupCallbacks.push(() => {
                variableUpdateWaiters.delete(handleVariableVersion);

                if (variableUpdateWaiters.size === 0) {
                    delete variableUpdateWaitersByName[watchedVariableName];
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

export const waitForSettledVariableUpdates = async (options: {
    baselineVersions: Record<string, number>;
    signal: AbortSignal;
    quietMs: number;
    timeoutMs?: number;
}): Promise<TVariableWaitResult> => {
    const watchedVariableNames = Object.keys(options.baselineVersions);
    if (watchedVariableNames.length === 0) {
        return {status: 'timeout', variables: []};
    }

    const observedVariableNames = new Set<string>();
    const deadlineTimestampMs =
        typeof options.timeoutMs === 'number'
            ? Date.now() + options.timeoutMs
            : undefined;
    let currentBaselineVersions = options.baselineVersions;

    while (true) {
        const remainingTimeoutMs = getRemainingTimeoutMs(deadlineTimestampMs);
        if (remainingTimeoutMs === 0) {
            return {
                status: 'timeout',
                variables: watchedVariableNames.filter((variableName) =>
                    observedVariableNames.has(variableName),
                ),
            };
        }

        const nextWaitTimeoutMs =
            observedVariableNames.size > 0
                ? remainingTimeoutMs === undefined
                    ? options.quietMs
                    : Math.min(options.quietMs, remainingTimeoutMs)
                : remainingTimeoutMs;

        const nextWaitResult = await waitForAnyVariableUpdate(
            currentBaselineVersions,
            options.signal,
            nextWaitTimeoutMs,
        );

        for (const changedVariableName of getChangedVariableNames(
            currentBaselineVersions,
        )) {
            observedVariableNames.add(changedVariableName);
        }

        for (const observedVariableName of nextWaitResult.variables) {
            observedVariableNames.add(observedVariableName);
        }

        if (nextWaitResult.status === 'timeout') {
            return {
                status: 'timeout',
                variables: watchedVariableNames.filter((variableName) =>
                    observedVariableNames.has(variableName),
                ),
            };
        }

        currentBaselineVersions =
            getVariableVersionSnapshotForNames(watchedVariableNames);
    }
};

export const getVariableSnapshot = (): Record<string, unknown> =>
    Object.fromEntries(
        getOrderedRegisteredVariableEntries().map(([name, variableState]) => [
            name,
            variableState.value,
        ]),
    );

export const serializeVariableSnapshot = (
    snapshot: Record<string, unknown>,
): string =>
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

export const createLiveVariablesObject = (): Record<string, unknown> => {
    const liveVariables = Object.create(null) as Record<string, unknown>;

    for (const [variableName] of getOrderedRegisteredVariableEntries()) {
        Object.defineProperty(liveVariables, variableName, {
            enumerable: true,
            configurable: false,
            get: () => registeredVariablesByName[variableName]?.value,
            set: () => {
                throw new Error(
                    'The `variables` object is read-only. Use page functions to request state changes.',
                );
            },
        });
    }

    return Object.freeze(liveVariables);
};

export const ensureRegisteredVariableNames = (
    variableNames: readonly string[],
): void => {
    const unknownVariableNames = variableNames.filter(
        (variableName) => registeredVariablesByName[variableName] === undefined,
    );

    if (unknownVariableNames.length > 0) {
        throw new Error(
            `Unknown variable name(s): ${unknownVariableNames.join(', ')}`,
        );
    }
};

export const setVariable = (options: {
    name: string;
    value: unknown;
    type: z.ZodType;
}): (() => void) => {
    const previousVariableState = registeredVariablesByName[options.name];
    const shouldAdvanceVersion =
        previousVariableState === undefined ||
        !Object.is(previousVariableState.value, options.value); // TODO: for objects maybe we want a deep equals
    const nextVersion = shouldAdvanceVersion
        ? getVariableVersion(options.name) + 1
        : getVariableVersion(options.name);

    registeredVariablesByName[options.name] = {
        value: options.value,
        type: options.type,
        version: nextVersion,
    };

    if (shouldAdvanceVersion) {
        notifyVariableUpdateWaiters(options.name, nextVersion);
    }

    return () => {
        unsetVariable({name: options.name});
    };
};

export const unsetVariable = (options: {name: string}): void => {
    delete registeredVariablesByName[options.name];
    delete variableUpdateWaitersByName[options.name];
};
