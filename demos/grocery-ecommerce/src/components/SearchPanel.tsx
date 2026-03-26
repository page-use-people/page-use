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
                className="grid min-w-0 rounded-[1.1rem] p-0 transition-[background,box-shadow] duration-[220ms] ease-out data-[agent-active=true]:bg-[rgba(249,252,247,0.96)] data-[agent-active=true]:shadow-[inset_0_0_0_1px_rgba(47,122,86,0.18),0_0_0_0.35rem_rgba(47,122,86,0.07)] data-[loading=true]:bg-[rgba(255,252,244,0.96)] data-[loading=true]:shadow-[inset_0_0_0_1px_rgba(216,161,63,0.16),0_0_0_0.35rem_rgba(216,161,63,0.07)]"
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
                    className="h-[2.95rem] w-full rounded-[1rem] border border-[var(--g-border)] bg-[rgba(255,255,254,0.96)] px-[0.92rem] text-[0.96rem] leading-[1.25] text-[var(--g-ink)] outline outline-2 outline-transparent shadow-[inset_0_1px_rgba(255,255,255,0.94),0_12px_24px_rgba(31,73,55,0.05)] transition-[transform,outline-color,box-shadow] duration-[220ms] ease-out placeholder:text-[rgba(102,125,114,0.76)] focus:-translate-y-px focus:outline-[rgba(47,122,86,0.52)] focus:shadow-[inset_0_1px_rgba(255,255,255,0.96),0_18px_38px_rgba(47,122,86,0.14)] data-[animating=true]:-translate-y-px data-[animating=true]:outline-[rgba(47,122,86,0.52)] data-[animating=true]:shadow-[inset_0_1px_rgba(255,255,255,0.96),0_18px_38px_rgba(47,122,86,0.14)] data-[agent-active=true]:-translate-y-px data-[agent-active=true]:outline-[rgba(47,122,86,0.52)] data-[agent-active=true]:shadow-[inset_0_1px_rgba(255,255,255,0.96),0_18px_38px_rgba(47,122,86,0.14)] data-[loading=true]:cursor-wait"
                    data-animating={searchIsAnimating ? 'true' : 'false'}
                    data-agent-active={
                        activeUiTarget === 'search-panel' ? 'true' : 'false'
                    }
                    placeholder="Search rice, maida, yogurt, or local brands"
                />
                {isSearchLoading ? (
                    <div
                        className="flex items-center justify-between gap-3 px-[0.15rem] pt-[0.45rem] text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-[rgba(64,102,83,0.8)]"
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
