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
                className="mt-[1rem] flex items-center justify-end gap-4 rounded-[1.35rem] border border-[var(--g-border)] bg-[rgba(255,255,254,0.95)] px-[1.05rem] py-[1rem] shadow-[inset_0_1px_rgba(255,255,255,0.86),0_14px_28px_rgba(31,73,55,0.06)] max-[760px]:flex-col max-[760px]:items-start max-[560px]:items-stretch">
                <div className="flex flex-wrap gap-[0.6rem] max-[760px]:w-full">
                    <button
                        ref={registerPreviousWindowButton}
                        type="button"
                        className="min-h-[2.7rem] min-w-[5.9rem] rounded-full border-0 bg-[var(--g-accent-strong)] px-[0.95rem] font-semibold text-[#f7fcf8] transition-[transform,opacity,background,box-shadow] duration-[220ms] ease-out enabled:hover:-translate-y-px enabled:hover:bg-[var(--g-accent)] disabled:cursor-not-allowed disabled:opacity-[0.36] data-[agent-active=true]:shadow-[0_0_0_0.28rem_rgba(47,122,86,0.16)]"
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
                        className="min-h-[2.7rem] min-w-[5.9rem] rounded-full border-0 bg-[var(--g-accent-strong)] px-[0.95rem] font-semibold text-[#f7fcf8] transition-[transform,opacity,background,box-shadow] duration-[220ms] ease-out enabled:hover:-translate-y-px enabled:hover:bg-[var(--g-accent)] disabled:cursor-not-allowed disabled:opacity-[0.36] data-[agent-active=true]:shadow-[0_0_0_0.28rem_rgba(47,122,86,0.16)]"
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
