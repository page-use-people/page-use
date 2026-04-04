import {memo} from 'react';
import {SearchPanel} from './SearchPanel.tsx';
import {ProductGrid} from './ProductGrid.tsx';
import {PaginationNav} from './PaginationNav.tsx';
import type {TCatalogProduct} from '../lib/catalog.ts';

type TCatalogBrowserWindow = {
    readonly canScrollNext: boolean;
    readonly canScrollPrevious: boolean;
};

type TCatalogBrowserProps = {
    readonly searchDraft: string;
    readonly searchIsAnimating: boolean;
    readonly loadingState: 'idle' | 'search' | 'catalog';
    readonly searchAppliedQuery?: string;
    readonly selectedCategoryLabel: string;
    readonly visibleProducts: readonly TCatalogProduct[];
    readonly catalogWindow: TCatalogBrowserWindow;
    readonly cartQuantities: Readonly<Record<number, number>>;
    readonly highlightedProductIds: ReadonlySet<number>;
    readonly onSearchDraftChange: (nextSearchDraft: string) => void;
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
        selectedCategoryLabel,
        visibleProducts,
        catalogWindow,
        cartQuantities,
        highlightedProductIds,
        onSearchDraftChange,
        onAdjustCart,
        onPreviousPage,
        onNextPage,
    }: TCatalogBrowserProps) => {
        const isLoading = loadingState !== 'idle';
        const isSearchLoading = loadingState === 'search';

        return (
            <section className="grocery-browser grid min-w-0 gap-3 pt-4">
                <section className="sticky top-0 z-20 grid min-w-0 bg-white px-4 py-2 max-md:px-3.5 max-md:py-3.5">
                    <SearchPanel
                        searchDraft={searchDraft}
                        searchIsAnimating={searchIsAnimating}
                        loadingState={loadingState}
                        searchAppliedQuery={searchAppliedQuery}
                        onSearchDraftChange={onSearchDraftChange}
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
        prev.selectedCategoryLabel === next.selectedCategoryLabel &&
        prev.visibleProducts === next.visibleProducts &&
        prev.catalogWindow === next.catalogWindow &&
        prev.cartQuantities === next.cartQuantities &&
        prev.highlightedProductIds === next.highlightedProductIds,
);

CatalogBrowser.displayName = 'CatalogBrowser';
