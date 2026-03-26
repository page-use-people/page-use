import {useCallback, useRef, useState} from 'react';

export const useLatestState = <T,>(
    initial: T | (() => T),
): readonly [T, (next: T | ((prev: T) => T)) => void, React.RefObject<T>] => {
    const [state, setRaw] = useState(initial);
    const ref = useRef(state);

    const set = useCallback((next: T | ((prev: T) => T)) => {
        if (typeof next === 'function') {
            setRaw((prev) => {
                const resolved = (next as (prev: T) => T)(prev);
                ref.current = resolved;
                return resolved;
            });
        } else {
            ref.current = next;
            setRaw(next);
        }
    }, []);

    return [state, set, ref] as const;
};
