import {useEffect, useRef} from 'react';
import {startTransition} from 'react';
import {normalizeSearchValue} from '../lib/catalog.ts';

const SEARCH_INPUT_DEBOUNCE_MS = 120;
const SEARCH_LOADING_MIN_MS = 260;

export const useSearchDebounce = (
    searchText: string,
    searchQuery: string,
    setSearchQuery: (next: string | ((prev: string) => string)) => void,
    setVisibleStartIndex: (next: number | ((prev: number) => number)) => void,
    setIsSearchLoading: (next: boolean | ((prev: boolean) => boolean)) => void,
) => {
    const searchCommitVersionRef = useRef(0);

    useEffect(() => {
        const normalizedDraft = normalizeSearchValue(searchText);
        const normalizedQuery = normalizeSearchValue(searchQuery);

        if (normalizedDraft === normalizedQuery) {
            setIsSearchLoading(false);
            return;
        }

        const requestVersion = searchCommitVersionRef.current + 1;
        searchCommitVersionRef.current = requestVersion;
        setIsSearchLoading(true);
        const startedAt = performance.now();

        let cancelled = false;
        let loadingTimer = 0;
        const debounceTimer = window.setTimeout(() => {
            const remainingDelay = Math.max(
                0,
                SEARCH_LOADING_MIN_MS - (performance.now() - startedAt),
            );

            const commit = () => {
                if (
                    cancelled ||
                    searchCommitVersionRef.current !== requestVersion
                ) {
                    return;
                }

                startTransition(() => {
                    setSearchQuery(searchText);
                    setVisibleStartIndex(0);
                    setIsSearchLoading(false);
                });
            };

            if (remainingDelay > 0) {
                loadingTimer = window.setTimeout(commit, remainingDelay);
                return;
            }

            commit();
        }, SEARCH_INPUT_DEBOUNCE_MS);

        return () => {
            cancelled = true;
            window.clearTimeout(debounceTimer);
            if (loadingTimer !== 0) {
                window.clearTimeout(loadingTimer);
            }
        };
    }, [
        searchQuery,
        searchText,
        setIsSearchLoading,
        setSearchQuery,
        setVisibleStartIndex,
    ]);
};
