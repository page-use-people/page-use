import {memo} from 'react';
import {useRegistryCallbacks} from '../contexts/element-registry-context.ts';
import {useAgentTarget} from '../contexts/agent-target-context.ts';
import type {TCatalogBrowserCategory} from '../hooks/use-catalog-state.ts';

type TCategoryNavProps = {
    readonly selectedCategory: string | null;
    readonly featuredCategories: readonly TCatalogBrowserCategory[];
    readonly onSelectAllAisles: () => void;
    readonly onSelectCategory: (categoryKey: string) => void;
};

export const CategoryNav = memo(
    ({
        selectedCategory,
        featuredCategories,
        onSelectAllAisles,
        onSelectCategory,
    }: TCategoryNavProps) => {
        const {registerAllCategoryButton, registerCategoryButton} =
            useRegistryCallbacks();
        const activeUiTarget = useAgentTarget();

        return (
            <nav
                className="flex flex-col gap-[0.45rem] overflow-y-auto py-[0.3rem]"
                aria-label="Browse product categories">
                <button
                    ref={registerAllCategoryButton}
                    type="button"
                    className="flex min-h-[2.15rem] w-full items-center justify-start rounded-[0.65rem] bg-white px-[0.92rem] py-[0.36rem] text-[var(--g-ink)] transition-[transform,background,color] duration-[220ms] ease-out data-[active=true]:bg-[var(--g-accent-strong)] data-[active=true]:text-[#f7fcf8] data-[agent-active=true]:shadow-[0_0_0_0.28rem_rgba(47,122,86,0.12)]"
                    data-active={
                        selectedCategory === null ? 'true' : 'false'
                    }
                    data-agent-active={
                        activeUiTarget === 'category:all' ? 'true' : 'false'
                    }
                    onClick={onSelectAllAisles}>
                    <span className="whitespace-nowrap text-[0.74rem] font-bold uppercase tracking-[0.08em]">
                        All aisles
                    </span>
                </button>

                {featuredCategories.map((category) => (
                    <button
                        key={category.key}
                        ref={(node) => {
                            registerCategoryButton(category.key, node);
                        }}
                        type="button"
                        className="flex min-h-[2.15rem] w-full items-center justify-start rounded-[0.65rem] bg-white px-[0.92rem] py-[0.36rem] text-[var(--g-ink)] transition-[transform,background,color] duration-[220ms] ease-out data-[active=true]:bg-[var(--g-accent-strong)] data-[active=true]:text-[#f7fcf8] data-[agent-active=true]:shadow-[0_0_0_0.28rem_rgba(47,122,86,0.12)]"
                        data-active={
                            selectedCategory === category.key
                                ? 'true'
                                : 'false'
                        }
                        data-agent-active={
                            activeUiTarget === `category:${category.key}`
                                ? 'true'
                                : 'false'
                        }
                        onClick={() => {
                            onSelectCategory(category.key);
                        }}>
                        <span className="whitespace-nowrap text-[0.74rem] font-bold uppercase tracking-[0.08em]">
                            {category.label}
                        </span>
                    </button>
                ))}
            </nav>
        );
    },
    (prev, next) =>
        prev.selectedCategory === next.selectedCategory &&
        prev.featuredCategories === next.featuredCategories,
);

CategoryNav.displayName = 'CategoryNav';
