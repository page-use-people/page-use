import {memo} from 'react';
import {SearchPanel} from './SearchPanel.tsx';
import {CategoryNav} from './CategoryNav.tsx';
import {ProductGrid} from './ProductGrid.tsx';
import {PaginationNav} from './PaginationNav.tsx';
import type {TCatalogProduct} from '../lib/catalog.ts';
import type {TCatalogBrowserCategory} from '../hooks/use-catalog-state.ts';

type TCatalogBrowserWindow = {
    readonly canScrollNext: boolean;
    readonly canScrollPrevious: boolean;
};

type TCatalogBrowserProps = {
    readonly searchDraft: string;
    readonly searchIsAnimating: boolean;
    readonly loadingState: 'idle' | 'search' | 'catalog';
    readonly searchAppliedQuery?: string;
    readonly showCategoryNav: boolean;
    readonly selectedCategory: string | null;
    readonly selectedCategoryLabel: string;
    readonly featuredCategories: readonly TCatalogBrowserCategory[];
    readonly visibleProducts: readonly TCatalogProduct[];
    readonly catalogWindow: TCatalogBrowserWindow;
    readonly cartQuantities: Readonly<Record<number, number>>;
    readonly highlightedProductIds: ReadonlySet<number>;
    readonly onSearchDraftChange: (nextSearchDraft: string) => void;
    readonly onSelectAllAisles: () => void;
    readonly onSelectCategory: (categoryKey: string) => void;
    readonly onAdjustCart: (productId: number, delta: number) => void;
    readonly onPreviousPage: () => void;
    readonly onNextPage: () => void;
};

export const CatalogBrowser = memo(
    ({
        searchDraft,
        searchIsAnimating,
        loadingState,
        searchAppliedQuery,
        showCategoryNav,
        selectedCategory,
        selectedCategoryLabel,
        featuredCategories,
        visibleProducts,
        catalogWindow,
        cartQuantities,
        highlightedProductIds,
        onSearchDraftChange,
        onSelectAllAisles,
        onSelectCategory,
        onAdjustCart,
        onPreviousPage,
        onNextPage,
    }: TCatalogBrowserProps) => {
        const isLoading = loadingState !== 'idle';
        const isSearchLoading = loadingState === 'search';

        return (
            <section className="grocery-browser grid min-w-0 gap-[1.35rem] max-w-[min(100%,77rem)] transition-[max-width] duration-[280ms] ease-out [.grocery-main-layout[data-cart-open='true']_&]:max-w-[min(100%,61rem)]">
                <section
                    className="sticky top-[1rem] z-[5] grid min-w-0 gap-[0.55rem] rounded-[1.8rem] border border-[var(--g-border)] bg-[var(--g-surface-strong)] px-[1rem] py-[0.95rem] shadow-[0_18px_34px_rgba(31,73,55,0.08),0_8px_18px_rgba(23,52,40,0.04)] outline outline-1 outline-white/80 backdrop-blur-[16px] max-[760px]:px-[0.9rem] max-[760px]:py-[0.85rem] data-[category-nav-visible=false]:gap-[0.15rem]"
                    data-category-nav-visible={
                        showCategoryNav ? 'true' : 'false'
                    }>
                    <SearchPanel
                        searchDraft={searchDraft}
                        searchIsAnimating={searchIsAnimating}
                        loadingState={loadingState}
                        searchAppliedQuery={searchAppliedQuery}
                        onSearchDraftChange={onSearchDraftChange}
                    />
                    <CategoryNav
                        showCategoryNav={showCategoryNav}
                        selectedCategory={selectedCategory}
                        featuredCategories={featuredCategories}
                        onSelectAllAisles={onSelectAllAisles}
                        onSelectCategory={onSelectCategory}
                    />
                </section>

                <ProductGrid
                    isLoading={isLoading}
                    isSearchLoading={isSearchLoading}
                    selectedCategoryLabel={selectedCategoryLabel}
                    visibleProducts={visibleProducts}
                    cartQuantities={cartQuantities}
                    highlightedProductIds={highlightedProductIds}
                    onAdjustCart={onAdjustCart}
                />

                {!isLoading &&
                (catalogWindow.canScrollPrevious ||
                    catalogWindow.canScrollNext) ? (
                    <PaginationNav
                        canScrollPrevious={catalogWindow.canScrollPrevious}
                        canScrollNext={catalogWindow.canScrollNext}
                        onPreviousPage={onPreviousPage}
                        onNextPage={onNextPage}
                    />
                ) : null}
            </section>
        );
    },
    (prev, next) =>
        prev.searchDraft === next.searchDraft &&
        prev.searchIsAnimating === next.searchIsAnimating &&
        prev.loadingState === next.loadingState &&
        prev.searchAppliedQuery === next.searchAppliedQuery &&
        prev.showCategoryNav === next.showCategoryNav &&
        prev.selectedCategory === next.selectedCategory &&
        prev.selectedCategoryLabel === next.selectedCategoryLabel &&
        prev.featuredCategories === next.featuredCategories &&
        prev.visibleProducts === next.visibleProducts &&
        prev.catalogWindow === next.catalogWindow &&
        prev.cartQuantities === next.cartQuantities &&
        prev.highlightedProductIds === next.highlightedProductIds,
);

CatalogBrowser.displayName = 'CatalogBrowser';
