import {memo} from 'react';
import {useRegistryCallbacks} from '../contexts/element-registry-context.ts';
import {useAgentTarget} from '../contexts/agent-target-context.ts';

type TPaginationNavProps = {
    readonly canScrollPrevious: boolean;
    readonly canScrollNext: boolean;
    readonly onPreviousPage: () => void;
    readonly onNextPage: () => void;
};

export const PaginationNav = memo(
    ({
        canScrollPrevious,
        canScrollNext,
        onPreviousPage,
        onNextPage,
    }: TPaginationNavProps) => {
        const {
            registerGridWindowNav,
            registerPreviousWindowButton,
            registerNextWindowButton,
        } = useRegistryCallbacks();
        const activeUiTarget = useAgentTarget();

        return (
            <div
                ref={registerGridWindowNav}
                className="mt-4 flex items-center justify-end gap-4 rounded-3xl bg-white px-4 py-4 max-md:flex-col max-md:items-start max-sm:items-stretch">
                <div className="flex flex-wrap gap-2.5 max-md:w-full">
                    <button
                        ref={registerPreviousWindowButton}
                        type="button"
                        className="min-h-11 min-w-24 rounded-full border-0 bg-[var(--g-accent-strong)] px-4 font-semibold text-[var(--g-on-accent)] transition-[transform,opacity,background,box-shadow] duration-200 ease-out enabled:hover:-translate-y-px enabled:hover:bg-[var(--g-accent)] disabled:cursor-not-allowed disabled:opacity-35 data-[agent-active=true]:shadow-[0_0_0_0.28rem_var(--g-accent-glow)]"
                        data-agent-active={
                            activeUiTarget === 'window:previous'
                                ? 'true'
                                : 'false'
                        }
                        disabled={!canScrollPrevious}
                        onClick={onPreviousPage}>
                        Previous
                    </button>
                    <button
                        ref={registerNextWindowButton}
                        type="button"
                        className="min-h-11 min-w-24 rounded-full border-0 bg-[var(--g-accent-strong)] px-4 font-semibold text-[var(--g-on-accent)] transition-[transform,opacity,background,box-shadow] duration-200 ease-out enabled:hover:-translate-y-px enabled:hover:bg-[var(--g-accent)] disabled:cursor-not-allowed disabled:opacity-35 data-[agent-active=true]:shadow-[0_0_0_0.28rem_var(--g-accent-glow)]"
                        data-agent-active={
                            activeUiTarget === 'window:next'
                                ? 'true'
                                : 'false'
                        }
                        disabled={!canScrollNext}
                        onClick={onNextPage}>
                        Next
                    </button>
                </div>
            </div>
        );
    },
    (prev, next) =>
        prev.canScrollPrevious === next.canScrollPrevious &&
        prev.canScrollNext === next.canScrollNext,
);

PaginationNav.displayName = 'PaginationNav';
