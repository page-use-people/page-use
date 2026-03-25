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
    readonly loadingState?: 'idle' | 'search' | 'catalog';
    readonly searchAppliedQuery?: string;
    readonly activeUiTarget: string | null;
    readonly showCategoryNav: boolean;
    readonly selectedCategory: string | null;
    readonly selectedCategoryLabel: string;
    readonly featuredCategories: readonly TCatalogBrowserCategory[];
    readonly visibleProducts: readonly TCatalogProduct[];
    readonly catalogWindow: TCatalogBrowserWindow;
    readonly cartQuantities: Readonly<Record<number, number>>;
    readonly highlightedProductIds: ReadonlySet<number>;
    readonly registerSearchPanelRef: (node: HTMLDivElement | null) => void;
    readonly registerSearchInputRef: (node: HTMLInputElement | null) => void;
    readonly registerAllCategoryButtonRef: (
        node: HTMLButtonElement | null,
    ) => void;
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
    readonly registerNextWindowButtonRef: (
        node: HTMLButtonElement | null,
    ) => void;
    readonly registerProductCardRef: (
        productId: number,
        node: HTMLElement | null,
    ) => void;
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
        loadingState = 'idle',
        searchAppliedQuery,
        activeUiTarget,
        showCategoryNav,
        selectedCategory,
        selectedCategoryLabel,
        featuredCategories,
        visibleProducts,
        catalogWindow,
        cartQuantities,
        highlightedProductIds,
        registerSearchPanelRef,
        registerSearchInputRef,
        registerAllCategoryButtonRef,
        registerCategoryButtonRef,
        registerGridSectionRef,
        registerGridHeadingRef,
        registerGridWindowNavRef,
        registerPreviousWindowButtonRef,
        registerNextWindowButtonRef,
        registerProductCardRef,
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
                    <div
                        ref={registerSearchPanelRef}
                        className="grid min-w-0 rounded-[1.1rem] p-0 transition-[background,box-shadow] duration-[220ms] ease-out data-[agent-active=true]:bg-[rgba(249,252,247,0.96)] data-[agent-active=true]:shadow-[inset_0_0_0_1px_rgba(47,122,86,0.18),0_0_0_0.35rem_rgba(47,122,86,0.07)] data-[loading=true]:bg-[rgba(255,252,244,0.96)] data-[loading=true]:shadow-[inset_0_0_0_1px_rgba(216,161,63,0.16),0_0_0_0.35rem_rgba(216,161,63,0.07)]"
                        data-loading={isLoading ? 'true' : 'false'}
                        data-agent-active={
                            activeUiTarget === 'search-panel' ? 'true' : 'false'
                        }>
                        <input
                            id="catalog-search"
                            ref={registerSearchInputRef}
                            aria-label="Search catalog"
                            aria-busy={isLoading}
                            value={searchDraft}
                            onChange={(event) => {
                                onSearchDraftChange(event.target.value);
                            }}
                            className="h-[2.95rem] w-full rounded-[1rem] border border-[var(--g-border)] bg-[rgba(255,255,254,0.96)] px-[0.92rem] text-[0.96rem] leading-[1.25] text-[var(--g-ink)] outline outline-2 outline-transparent shadow-[inset_0_1px_rgba(255,255,255,0.94),0_12px_24px_rgba(31,73,55,0.05)] transition-[transform,outline-color,box-shadow] duration-[220ms] ease-out placeholder:text-[rgba(102,125,114,0.76)] focus:-translate-y-px focus:outline-[rgba(47,122,86,0.52)] focus:shadow-[inset_0_1px_rgba(255,255,255,0.96),0_18px_38px_rgba(47,122,86,0.14)] data-[animating=true]:-translate-y-px data-[animating=true]:outline-[rgba(47,122,86,0.52)] data-[animating=true]:shadow-[inset_0_1px_rgba(255,255,255,0.96),0_18px_38px_rgba(47,122,86,0.14)] data-[agent-active=true]:-translate-y-px data-[agent-active=true]:outline-[rgba(47,122,86,0.52)] data-[agent-active=true]:shadow-[inset_0_1px_rgba(255,255,255,0.96),0_18px_38px_rgba(47,122,86,0.14)] data-[loading=true]:cursor-wait"
                            data-animating={
                                searchIsAnimating ? 'true' : 'false'
                            }
                            data-agent-active={
                                activeUiTarget === 'search-panel'
                                    ? 'true'
                                    : 'false'
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

                    <nav
                        className="flex max-h-[3.8rem] gap-[0.45rem] overflow-x-auto overflow-y-hidden px-[0.08rem] pb-[0.28rem] pt-[0.3rem] -mx-[0.08rem] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden transition-[max-height,opacity,transform,padding,margin] duration-200 ease-out data-[visible=false]:max-h-0 data-[visible=false]:pointer-events-none data-[visible=false]:mx-0 data-[visible=false]:px-0 data-[visible=false]:py-0 data-[visible=false]:opacity-0 data-[visible=false]:-translate-y-[0.35rem]"
                        data-visible={showCategoryNav ? 'true' : 'false'}
                        aria-label="Browse product categories"
                        aria-hidden={showCategoryNav ? undefined : true}
                        inert={!showCategoryNav}>
                        <button
                            ref={registerAllCategoryButtonRef}
                            type="button"
                            className="inline-flex min-h-[2.15rem] min-w-max items-center justify-center rounded-full border border-[var(--g-border)] bg-[rgba(255,255,254,0.9)] px-[0.92rem] py-[0.36rem] text-[var(--g-ink)] transition-[transform,background,color,box-shadow,border-color] duration-[220ms] ease-out data-[active=true]:-translate-y-px data-[active=true]:bg-[var(--g-accent-strong)] data-[active=true]:text-[#f7fcf8] data-[agent-active=true]:border-[rgba(47,122,86,0.22)] data-[agent-active=true]:shadow-[0_0_0_0.28rem_rgba(47,122,86,0.12)]"
                            data-active={
                                selectedCategory === null ? 'true' : 'false'
                            }
                            data-agent-active={
                                activeUiTarget === 'category:all'
                                    ? 'true'
                                    : 'false'
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
                                    registerCategoryButtonRef(
                                        category.key,
                                        node,
                                    );
                                }}
                                type="button"
                                className="inline-flex min-h-[2.15rem] min-w-max items-center justify-center rounded-full border border-[var(--g-border)] bg-[rgba(255,255,254,0.9)] px-[0.92rem] py-[0.36rem] text-[var(--g-ink)] transition-[transform,background,color,box-shadow,border-color] duration-[220ms] ease-out data-[active=true]:-translate-y-px data-[active=true]:bg-[var(--g-accent-strong)] data-[active=true]:text-[#f7fcf8] data-[agent-active=true]:border-[rgba(47,122,86,0.22)] data-[agent-active=true]:shadow-[0_0_0_0.28rem_rgba(47,122,86,0.12)]"
                                data-active={
                                    selectedCategory === category.key
                                        ? 'true'
                                        : 'false'
                                }
                                data-agent-active={
                                    activeUiTarget ===
                                    `category:${category.key}`
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
                </section>

                <section
                    ref={registerGridSectionRef}
                    className="min-w-0 rounded-[1.8rem] border border-[var(--g-border)] bg-[var(--g-surface-strong)] p-[1.1rem] shadow-[0_20px_48px_rgba(31,73,55,0.06)] backdrop-blur-[16px] max-[760px]:rounded-[1.35rem]">
                    <div
                        ref={registerGridHeadingRef}
                        className="mb-[0.85rem] flex min-w-0 items-end justify-between gap-4">
                        <div className="grid gap-[0.12rem]">
                            <h2 className="text-[clamp(1.5rem,2.4vw,2.2rem)] font-semibold leading-tight">
                                {selectedCategoryLabel}
                            </h2>
                            {isSearchLoading ? (
                                <p className="text-sm font-medium text-[var(--g-ink-muted)]">
                                    Search in flight. Waiting for fresh results.
                                </p>
                            ) : null}
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="grid min-w-0 gap-[0.85rem] grid-cols-4 max-[1320px]:grid-cols-3 max-[980px]:grid-cols-2 max-[560px]:grid-cols-1 [.grocery-main-layout[data-cart-open='true']_&]:grid-cols-3">
                            {Array.from({length: 8}, (_, index) => (
                                <div
                                    key={index}
                                    className="grid gap-[0.72rem] overflow-hidden rounded-[1.22rem] border border-[var(--g-border)] bg-[rgba(255,255,254,0.97)] p-[0.78rem] shadow-[inset_0_1px_rgba(255,255,255,0.94),0_16px_28px_rgba(31,73,55,0.04)]">
                                    <div className="grid min-h-[8.75rem] place-items-center rounded-[1rem] bg-[rgba(250,251,247,0.96)] px-[0.3rem] py-[0.72rem]">
                                        <div className="h-[6.6rem] w-[6.6rem] rounded-[1.4rem] bg-white/70 animate-pulse" />
                                    </div>
                                    <div className="grid gap-[0.45rem]">
                                        <div className="h-3.5 w-2/5 rounded-full bg-[#d8e8d8] animate-pulse" />
                                        <div className="h-4.5 w-4/5 rounded-full bg-[#c1d9c4] animate-pulse" />
                                        <div className="h-4 w-3/5 rounded-full bg-[#d8e8d8] animate-pulse" />
                                    </div>
                                    <div className="mt-1 flex items-center justify-between gap-3">
                                        <div className="h-5 w-20 rounded-full bg-[#e6d79d] animate-pulse" />
                                        <div className="h-10 w-28 rounded-full bg-white/80 animate-pulse" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : visibleProducts.length > 0 ? (
                        <div className="grocery-product-grid grid min-w-0 gap-[0.85rem] grid-cols-4 max-[1320px]:grid-cols-3 max-[980px]:grid-cols-2 max-[560px]:grid-cols-1 [.grocery-main-layout[data-cart-open='true']_&]:grid-cols-3">
                            {visibleProducts.map((product) => (
                                <ProductCard
                                    key={product.id}
                                    product={product}
                                    quantityInCart={
                                        cartQuantities[product.id] ?? 0
                                    }
                                    isHighlighted={highlightedProductIds.has(
                                        product.id,
                                    )}
                                    isAgentActive={
                                        activeUiTarget ===
                                        `product:${product.id}`
                                    }
                                    onAdjustCart={(delta) => {
                                        onAdjustCart(product.id, delta);
                                    }}
                                    registerRef={(node) => {
                                        registerProductCardRef(
                                            product.id,
                                            node,
                                        );
                                    }}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="grid min-h-[13rem] place-items-center gap-[0.45rem] rounded-[1.2rem] bg-[rgba(250,251,247,0.92)] px-[1.1rem] py-[2.25rem] text-center">
                            <h3 className="text-[clamp(1.5rem,3vw,2rem)] font-semibold">
                                No products found
                            </h3>
                        </div>
                    )}

                    {!isLoading &&
                    (catalogWindow.canScrollPrevious ||
                        catalogWindow.canScrollNext) ? (
                        <div
                            ref={registerGridWindowNavRef}
                            className="mt-[1rem] flex items-center justify-end gap-4 rounded-[1.35rem] border border-[var(--g-border)] bg-[rgba(255,255,254,0.95)] px-[1.05rem] py-[1rem] shadow-[inset_0_1px_rgba(255,255,255,0.86),0_14px_28px_rgba(31,73,55,0.06)] max-[760px]:flex-col max-[760px]:items-start max-[560px]:items-stretch">
                            <div className="flex flex-wrap gap-[0.6rem] max-[760px]:w-full">
                                <button
                                    ref={registerPreviousWindowButtonRef}
                                    type="button"
                                    className="min-h-[2.7rem] min-w-[5.9rem] rounded-full border-0 bg-[var(--g-accent-strong)] px-[0.95rem] font-semibold text-[#f7fcf8] transition-[transform,opacity,background,box-shadow] duration-[220ms] ease-out enabled:hover:-translate-y-px enabled:hover:bg-[var(--g-accent)] disabled:cursor-not-allowed disabled:opacity-[0.36] data-[agent-active=true]:shadow-[0_0_0_0.28rem_rgba(47,122,86,0.16)]"
                                    data-agent-active={
                                        activeUiTarget === 'window:previous'
                                            ? 'true'
                                            : 'false'
                                    }
                                    disabled={!catalogWindow.canScrollPrevious}
                                    onClick={onPreviousPage}>
                                    Previous
                                </button>
                                <button
                                    ref={registerNextWindowButtonRef}
                                    type="button"
                                    className="min-h-[2.7rem] min-w-[5.9rem] rounded-full border-0 bg-[var(--g-accent-strong)] px-[0.95rem] font-semibold text-[#f7fcf8] transition-[transform,opacity,background,box-shadow] duration-[220ms] ease-out enabled:hover:-translate-y-px enabled:hover:bg-[var(--g-accent)] disabled:cursor-not-allowed disabled:opacity-[0.36] data-[agent-active=true]:shadow-[0_0_0_0.28rem_rgba(47,122,86,0.16)]"
                                    data-agent-active={
                                        activeUiTarget === 'window:next'
                                            ? 'true'
                                            : 'false'
                                    }
                                    disabled={!catalogWindow.canScrollNext}
                                    onClick={onNextPage}>
                                    Next
                                </button>
                            </div>
                        </div>
                    ) : null}
                </section>
            </section>
        );
    },
    (previousProps, nextProps) =>
        previousProps.searchDraft === nextProps.searchDraft &&
        previousProps.searchIsAnimating === nextProps.searchIsAnimating &&
        previousProps.loadingState === nextProps.loadingState &&
        previousProps.searchAppliedQuery === nextProps.searchAppliedQuery &&
        previousProps.activeUiTarget === nextProps.activeUiTarget &&
        previousProps.showCategoryNav === nextProps.showCategoryNav &&
        previousProps.selectedCategory === nextProps.selectedCategory &&
        previousProps.selectedCategoryLabel ===
            nextProps.selectedCategoryLabel &&
        previousProps.featuredCategories === nextProps.featuredCategories &&
        previousProps.visibleProducts === nextProps.visibleProducts &&
        previousProps.catalogWindow === nextProps.catalogWindow &&
        previousProps.cartQuantities === nextProps.cartQuantities &&
        previousProps.highlightedProductIds === nextProps.highlightedProductIds,
);

CatalogBrowser.displayName = 'CatalogBrowser';
