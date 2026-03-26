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
                className="flex flex-col gap-2 overflow-y-auto py-7"
                aria-label="Browse product categories">
                <button
                    ref={registerAllCategoryButton}
                    type="button"
                    className="flex min-h-9 w-full items-center justify-start rounded-xl bg-white px-3.5 py-1.5 text-[var(--g-ink)] transition-[transform,background,color] duration-200 ease-out data-[active=true]:bg-[var(--g-accent-strong)] data-[active=true]:text-[var(--g-on-accent)] data-[agent-active=true]:shadow-[0_0_0_0.28rem_var(--g-accent-glow)]"
                    data-active={selectedCategory === null ? 'true' : 'false'}
                    data-agent-active={
                        activeUiTarget === 'category:all' ? 'true' : 'false'
                    }
                    onClick={onSelectAllAisles}>
                    <span className="whitespace-nowrap text-sm font-semibold">
                        All
                    </span>
                </button>

                {featuredCategories.map((category) => (
                    <button
                        key={category.key}
                        ref={(node) => {
                            registerCategoryButton(category.key, node);
                        }}
                        type="button"
                        className="flex min-h-9 w-full items-center justify-start rounded-xl bg-white px-3.5 py-1.5 text-[var(--g-ink)] transition-[transform,background,color] duration-200 ease-out data-[active=true]:bg-[var(--g-accent-strong)] data-[active=true]:text-[var(--g-on-accent)] data-[agent-active=true]:shadow-[0_0_0_0.28rem_var(--g-accent-glow)]"
                        data-active={
                            selectedCategory === category.key ? 'true' : 'false'
                        }
                        data-agent-active={
                            activeUiTarget === `category:${category.key}`
                                ? 'true'
                                : 'false'
                        }
                        onClick={() => {
                            onSelectCategory(category.key);
                        }}>
                        <span className="whitespace-nowrap text-sm font-semibold">
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
