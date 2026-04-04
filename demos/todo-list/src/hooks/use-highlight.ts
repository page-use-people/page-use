import { useState, useRef, useCallback } from 'react';
import { HIGHLIGHT_DURATION_MS } from '../constants.ts';

export const useHighlight = () => {
    const [highlightedIDs, setHighlightedIDs] = useState<ReadonlySet<string>>(new Set());
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const highlightItems = useCallback((ids: ReadonlyArray<string>) => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }
        setHighlightedIDs(new Set(ids));
        timerRef.current = setTimeout(() => {
            setHighlightedIDs(new Set());
            timerRef.current = null;
        }, HIGHLIGHT_DURATION_MS);
    }, []);

    return { highlightedIDs, highlightItems } as const;
};
