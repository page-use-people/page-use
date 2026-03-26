import {memo} from 'react';
import {useRegistryCallbacks} from '../contexts/element-registry-context.ts';
import {useAgentTarget} from '../contexts/agent-target-context.ts';

type TSearchPanelProps = {
    readonly searchDraft: string;
    readonly searchIsAnimating: boolean;
    readonly loadingState: 'idle' | 'search' | 'catalog';
    readonly searchAppliedQuery?: string;
    readonly onSearchDraftChange: (nextSearchDraft: string) => void;
};

export const SearchPanel = memo(
    ({
        searchDraft,
        searchIsAnimating,
        loadingState,
        searchAppliedQuery,
        onSearchDraftChange,
    }: TSearchPanelProps) => {
        const {registerSearchPanel, registerSearchInput} =
            useRegistryCallbacks();
        const activeUiTarget = useAgentTarget();
        const isLoading = loadingState !== 'idle';
        const isSearchLoading = loadingState === 'search';

        return (
            <div
                ref={registerSearchPanel}
                className="grid min-w-0 rounded-2xl p-0"
                data-loading={isLoading ? 'true' : 'false'}
                data-agent-active={
                    activeUiTarget === 'search-panel' ? 'true' : 'false'
                }>
                <input
                    id="catalog-search"
                    ref={registerSearchInput}
                    aria-label="Search catalog"
                    aria-busy={isLoading}
                    value={searchDraft}
                    onChange={(event) => {
                        onSearchDraftChange(event.target.value);
                    }}
                    className="h-12 border-stone-200 focus:border-amber-500 border w-full rounded-lg bg-white px-3.5 text-base leading-tight text-[var(--g-ink)] outline outline-2 outline-transparent transition-[transform,outline-color] duration-200 ease-out placeholder:text-[var(--g-ink-muted)] data-[loading=true]:cursor-wait"
                    data-animating={searchIsAnimating ? 'true' : 'false'}
                    data-agent-active={
                        activeUiTarget === 'search-panel' ? 'true' : 'false'
                    }
                    placeholder="Search rice, maida, yogurt, or local brands"
                />
                {isSearchLoading ? (
                    <div
                        className="flex items-center justify-between gap-3 px-0.5 pt-2 text-xs font-semibold uppercase tracking-widest text-[rgba(64,102,83,0.8)]"
                        aria-live="polite">
                        <span className="inline-flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-[var(--g-accent)] motion-safe:animate-pulse" />
                            Searching
                        </span>
                        <span className="truncate text-right">
                            {searchDraft.trim() ||
                                searchAppliedQuery?.trim() ||
                                'catalog'}
                        </span>
                    </div>
                ) : null}
            </div>
        );
    },
    (prev, next) =>
        prev.searchDraft === next.searchDraft &&
        prev.searchIsAnimating === next.searchIsAnimating &&
        prev.loadingState === next.loadingState &&
        prev.searchAppliedQuery === next.searchAppliedQuery,
);

SearchPanel.displayName = 'SearchPanel';
