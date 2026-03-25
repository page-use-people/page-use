import {memo} from 'react';
import {ProductCard} from './ProductCard.tsx';
import type {TCatalogProduct} from '../lib/catalog.ts';

export type TCatalogBrowserCategory = {
    readonly key: string;
    readonly label: string;
    readonly count: number;
};

export type TCatalogBrowserWindow = {
    readonly visibleFrom: number;
    readonly visibleTo: number;
    readonly visibleCount: number;
    readonly totalMatches: number;
    readonly canScrollNext: boolean;
    readonly canScrollPrevious: boolean;
};

export type TCatalogBrowserProps = {
    readonly searchDraft: string;
    readonly searchIsAnimating: boolean;
    readonly activeUiTarget: string | null;
    readonly selectedCategory: string | null;
    readonly selectedCategoryLabel: string;
    readonly featuredCategories: readonly TCatalogBrowserCategory[];
    readonly visibleProducts: readonly TCatalogProduct[];
    readonly catalogWindow: TCatalogBrowserWindow;
    readonly cartQuantities: Readonly<Record<number, number>>;
    readonly highlightedProductId: number | null;
    readonly registerSearchPanelRef: (node: HTMLDivElement | null) => void;
    readonly registerSearchInputRef: (node: HTMLInputElement | null) => void;
    readonly registerSearchSubmitButtonRef: (node: HTMLButtonElement | null) => void;
    readonly registerSearchClearButtonRef: (node: HTMLButtonElement | null) => void;
    readonly registerAllCategoryButtonRef: (node: HTMLButtonElement | null) => void;
    readonly registerCategoryButtonRef: (
        categoryKey: string,
        node: HTMLButtonElement | null,
    ) => void;
    readonly registerGridSectionRef: (node: HTMLElement | null) => void;
    readonly registerGridHeadingRef: (node: HTMLDivElement | null) => void;
    readonly registerGridWindowNavRef: (node: HTMLDivElement | null) => void;
    readonly registerPreviousWindowButtonRef: (
        node: HTMLButtonElement | null,
    ) => void;
    readonly registerNextWindowButtonRef: (node: HTMLButtonElement | null) => void;
    readonly registerProductCardRef: (productId: number, node: HTMLElement | null) => void;
    readonly onSearchDraftChange: (nextSearchDraft: string) => void;
    readonly onSearchSubmit: () => void;
    readonly onSearchClear: () => void;
    readonly onSelectAllAisles: () => void;
    readonly onSelectCategory: (categoryKey: string) => void;
    readonly onOpenProduct: (productId: number) => void;
    readonly onPreviousPage: () => void;
    readonly onNextPage: () => void;
};

export const CatalogBrowser = memo(
    ({
        searchDraft,
        searchIsAnimating,
        activeUiTarget,
        selectedCategory,
        selectedCategoryLabel,
        featuredCategories,
        visibleProducts,
        catalogWindow,
        cartQuantities,
        highlightedProductId,
        registerSearchPanelRef,
        registerSearchInputRef,
        registerSearchSubmitButtonRef,
        registerSearchClearButtonRef,
        registerAllCategoryButtonRef,
        registerCategoryButtonRef,
        registerGridSectionRef,
        registerGridHeadingRef,
        registerGridWindowNavRef,
        registerPreviousWindowButtonRef,
        registerNextWindowButtonRef,
        registerProductCardRef,
        onSearchDraftChange,
        onSearchSubmit,
        onSearchClear,
        onSelectAllAisles,
        onSelectCategory,
        onOpenProduct,
        onPreviousPage,
        onNextPage,
    }: TCatalogBrowserProps) => (
        <section className="grocery-browser">
            <section className="grocery-controls">
                <div
                    ref={registerSearchPanelRef}
                    className="grocery-search-panel"
                    data-agent-active={activeUiTarget === 'search-panel' ? 'true' : 'false'}>
                    <label htmlFor="catalog-search" className="grocery-search-label">
                        Search products
                    </label>

                    <form
                        className="grocery-search-row"
                        onSubmit={(event) => {
                            event.preventDefault();
                            onSearchSubmit();
                        }}>
                        <input
                            id="catalog-search"
                            ref={registerSearchInputRef}
                            value={searchDraft}
                            onChange={(event) => {
                                onSearchDraftChange(event.target.value);
                            }}
                            className="grocery-search-input"
                            data-animating={searchIsAnimating ? 'true' : 'false'}
                            data-agent-active={
                                activeUiTarget === 'search-panel' ? 'true' : 'false'
                            }
                            placeholder="Search milk, juice, butter, noodles..."
                        />

                        <div className="grocery-search-actions">
                            <button
                                ref={registerSearchSubmitButtonRef}
                                type="submit"
                                className="grocery-search-submit"
                                data-agent-active={
                                    activeUiTarget === 'search-submit' ? 'true' : 'false'
                                }>
                                Search
                            </button>

                            <button
                                ref={registerSearchClearButtonRef}
                                type="button"
                                className="grocery-search-reset"
                                data-agent-active={
                                    activeUiTarget === 'search-clear' ? 'true' : 'false'
                                }
                                onClick={onSearchClear}>
                                Clear
                            </button>
                        </div>
                    </form>
                </div>

                <nav
                    className="grocery-category-nav"
                    aria-label="Browse product categories">
                    <button
                        ref={registerAllCategoryButtonRef}
                        type="button"
                        data-active={selectedCategory === null ? 'true' : 'false'}
                        data-agent-active={
                            activeUiTarget === 'category:all' ? 'true' : 'false'
                        }
                        className="grocery-category-pill"
                        onClick={onSelectAllAisles}>
                        <span>All aisles</span>
                    </button>

                    {featuredCategories.map((category) => (
                        <button
                            key={category.key}
                            ref={(node) => {
                                registerCategoryButtonRef(category.key, node);
                            }}
                            type="button"
                            data-active={
                                selectedCategory === category.key ? 'true' : 'false'
                            }
                            data-agent-active={
                                activeUiTarget === `category:${category.key}`
                                    ? 'true'
                                    : 'false'
                            }
                            className="grocery-category-pill"
                            onClick={() => {
                                onSelectCategory(category.key);
                            }}>
                            <span>{category.label}</span>
                        </button>
                    ))}
                </nav>
            </section>

            <section ref={registerGridSectionRef} className="grocery-grid-shell">
                <div ref={registerGridHeadingRef} className="grocery-grid-heading">
                    <div className="grocery-grid-heading__copy">
                        <h2>{selectedCategoryLabel}</h2>
                        <p className="grocery-grid-heading__meta">
                            {catalogWindow.totalMatches > 0
                                ? `${catalogWindow.totalMatches} curated matches`
                                : 'No matching products yet'}
                        </p>
                    </div>
                </div>

                {visibleProducts.length > 0 ? (
                    <div className="grocery-product-grid">
                        {visibleProducts.map((product) => (
                            <ProductCard
                                key={product.id}
                                product={product}
                                quantityInCart={cartQuantities[product.id] ?? 0}
                                isHighlighted={highlightedProductId === product.id}
                                isAgentActive={
                                    activeUiTarget === `product:${product.id}`
                                }
                                onOpen={() => {
                                    onOpenProduct(product.id);
                                }}
                                registerRef={(node) => {
                                    registerProductCardRef(product.id, node);
                                }}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="grocery-empty-state">
                        <h3>No products found</h3>
                    </div>
                )}

                <div ref={registerGridWindowNavRef} className="grocery-grid-window-nav">
                    <p className="grocery-grid-window-nav__status">
                        {catalogWindow.visibleCount > 0
                            ? `${catalogWindow.visibleFrom}-${catalogWindow.visibleTo} of ${catalogWindow.totalMatches}`
                            : 'No matching products'}
                    </p>

                    <div className="grocery-grid-window-nav__actions">
                        <button
                            ref={registerPreviousWindowButtonRef}
                            type="button"
                            className="grocery-grid-window-nav__button"
                            data-agent-active={
                                activeUiTarget === 'window:previous' ? 'true' : 'false'
                            }
                            disabled={!catalogWindow.canScrollPrevious}
                            onClick={onPreviousPage}>
                            Previous
                        </button>
                        <button
                            ref={registerNextWindowButtonRef}
                            type="button"
                            className="grocery-grid-window-nav__button"
                            data-agent-active={
                                activeUiTarget === 'window:next' ? 'true' : 'false'
                            }
                            disabled={!catalogWindow.canScrollNext}
                            onClick={onNextPage}>
                            Next
                        </button>
                    </div>
                </div>
            </section>
        </section>
    ),
    (previousProps, nextProps) =>
        previousProps.searchDraft === nextProps.searchDraft &&
        previousProps.searchIsAnimating === nextProps.searchIsAnimating &&
        previousProps.activeUiTarget === nextProps.activeUiTarget &&
        previousProps.selectedCategory === nextProps.selectedCategory &&
        previousProps.selectedCategoryLabel === nextProps.selectedCategoryLabel &&
        previousProps.featuredCategories === nextProps.featuredCategories &&
        previousProps.visibleProducts === nextProps.visibleProducts &&
        previousProps.catalogWindow === nextProps.catalogWindow &&
        previousProps.cartQuantities === nextProps.cartQuantities &&
        previousProps.highlightedProductId === nextProps.highlightedProductId,
);

CatalogBrowser.displayName = 'CatalogBrowser';
