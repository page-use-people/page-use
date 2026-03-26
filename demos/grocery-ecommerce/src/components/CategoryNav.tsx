import {memo} from 'react';
import {useRegistryCallbacks} from '../contexts/element-registry-context.ts';
import {useAgentTarget} from '../contexts/agent-target-context.ts';
import type {TCatalogBrowserCategory} from '../hooks/use-catalog-state.ts';

type TCategoryNavProps = {
    readonly showCategoryNav: boolean;
    readonly selectedCategory: string | null;
    readonly featuredCategories: readonly TCatalogBrowserCategory[];
    readonly onSelectAllAisles: () => void;
    readonly onSelectCategory: (categoryKey: string) => void;
};

export const CategoryNav = memo(
    ({
        showCategoryNav,
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
                className="flex max-h-[3.8rem] gap-[0.45rem] overflow-x-auto overflow-y-hidden px-[0.08rem] pb-[0.28rem] pt-[0.3rem] -mx-[0.08rem] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden transition-[max-height,opacity,transform,padding,margin] duration-200 ease-out data-[visible=false]:max-h-0 data-[visible=false]:pointer-events-none data-[visible=false]:mx-0 data-[visible=false]:px-0 data-[visible=false]:py-0 data-[visible=false]:opacity-0 data-[visible=false]:-translate-y-[0.35rem]"
                data-visible={showCategoryNav ? 'true' : 'false'}
                aria-label="Browse product categories"
                aria-hidden={showCategoryNav ? undefined : true}
                inert={!showCategoryNav}>
                <button
                    ref={registerAllCategoryButton}
                    type="button"
                    className="inline-flex min-h-[2.15rem] min-w-max items-center justify-center rounded-full border border-[var(--g-border)] bg-[rgba(255,255,254,0.9)] px-[0.92rem] py-[0.36rem] text-[var(--g-ink)] transition-[transform,background,color,box-shadow,border-color] duration-[220ms] ease-out data-[active=true]:-translate-y-px data-[active=true]:bg-[var(--g-accent-strong)] data-[active=true]:text-[#f7fcf8] data-[agent-active=true]:border-[rgba(47,122,86,0.22)] data-[agent-active=true]:shadow-[0_0_0_0.28rem_rgba(47,122,86,0.12)]"
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
                        className="inline-flex min-h-[2.15rem] min-w-max items-center justify-center rounded-full border border-[var(--g-border)] bg-[rgba(255,255,254,0.9)] px-[0.92rem] py-[0.36rem] text-[var(--g-ink)] transition-[transform,background,color,box-shadow,border-color] duration-[220ms] ease-out data-[active=true]:-translate-y-px data-[active=true]:bg-[var(--g-accent-strong)] data-[active=true]:text-[#f7fcf8] data-[agent-active=true]:border-[rgba(47,122,86,0.22)] data-[agent-active=true]:shadow-[0_0_0_0.28rem_rgba(47,122,86,0.12)]"
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
        prev.showCategoryNav === next.showCategoryNav &&
        prev.selectedCategory === next.selectedCategory &&
        prev.featuredCategories === next.featuredCategories,
);

CategoryNav.displayName = 'CategoryNav';
