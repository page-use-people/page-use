import {startTransition, useMemo, useState} from 'react';
import {
    useAgentFunction,
    useAgentVariable,
    z,
} from '@page-use/react';
import type {TElementRegistry} from './use-element-registry.ts';
import type {TCursorAnimation} from './use-cursor-animation.ts';
import type {TScrollReveal} from './use-scroll-reveal.ts';
import type {TCatalogState, TCatalogBrowserCategory} from './use-catalog-state.ts';
import {buildVisibleSearchResults} from './use-catalog-state.ts';
import type {TCartState as TCartStateHook} from './use-cart-state.ts';
import {
    type TUITarget,
    serializeUITarget,
    searchPanelTarget,
    categoryTarget,
    productTarget,
    cartLineTarget,
    windowNavTarget,
} from '../types/ui-target.ts';
import {
    MAX_VISIBLE_PRODUCTS,
    SEARCH_TYPING_BASE_MS,
    buildCatalogWindow,
    clampWindowStart,
    getFilteredProducts,
    type TAnimateSearchResult,
    type TCatalogWindow,
    type TCategoryResult,
} from '../lib/catalog-browser.ts';
import {wait} from '../lib/catalog.ts';
import {waitForUi, nextFrame} from '../lib/async-animation.ts';
import {
    animateSearchInputSchema,
    animateSearchOutputSchema,
    cartInputSchema,
    cartOutputSchema,
    cartSummarySchema,
    catalogWindowSchema,
    catalogWindowSummarySchema,
    categorySelectionOutputSchema,
    categorySelectionSchema,
    chatTheme,
    featuredCategorySchema,
    scrollCatalogInputSchema,
    searchStatusSchema,
    systemPrompt,
    visibleProductCardSchema,
    type TCartResult,
} from '../lib/assistant.ts';
import type {TCartMutation} from '../lib/cart.ts';

const AGENT_MUTATION_TIMEOUT_MS = 8_000;

export const useAgentIntegration = (
    catalogState: TCatalogState,
    cartStateHook: TCartStateHook,
    refs: TElementRegistry,
    cursor: TCursorAnimation,
    scrollReveal: TScrollReveal,
    flashProducts: (productIds: readonly number[], duration?: number) => void,
) => {
    const [activeUiTarget, setActiveUiTargetRaw] = useState<TUITarget | null>(
        null,
    );

    const serializedTarget = activeUiTarget
        ? serializeUITarget(activeUiTarget)
        : null;

    const setActiveUiTarget = (target: TUITarget | null) => {
        setActiveUiTargetRaw(target);
    };

    const hideCursorAndTarget = () => {
        cursor.hideCursor();
        setActiveUiTarget(null);
    };

    // ── Agent variable summaries ──────────────────────────────────

    const featuredCategorySummary = useMemo(
        () =>
            catalogState.featuredCategories.length > 0
                ? catalogState.featuredCategories
                      .map(
                          (category: TCatalogBrowserCategory) =>
                              `${category.key}: ${category.label}`,
                      )
                      .join(' | ')
                : 'none',
        [catalogState.featuredCategories],
    );

    const visibleSearchResults = useMemo(
        () =>
            buildVisibleSearchResults(
                catalogState.visibleProducts,
                cartStateHook.cartQuantities,
            ),
        [cartStateHook.cartQuantities, catalogState.visibleProducts],
    );

    const catalogWindowSummary = useMemo(() => {
        if (catalogState.isSearchLoading) {
            const pendingQuery =
                catalogState.searchText.trim() || 'all products';
            return `search loading for "${pendingQuery}" — wait`;
        }

        if (catalogState.catalogWindow.totalMatches === 0) {
            return '0 results';
        }

        return `${catalogState.catalogWindow.visibleFrom}-${catalogState.catalogWindow.visibleTo} of ${catalogState.catalogWindow.totalMatches}; previous ${catalogState.catalogWindow.canScrollPrevious ? 'yes' : 'no'}; next ${catalogState.catalogWindow.canScrollNext ? 'yes' : 'no'}`;
    }, [catalogState.catalogWindow, catalogState.isSearchLoading, catalogState.searchText]);

    const searchStatusSummary = useMemo(() => {
        const draftQuery = catalogState.searchText.trim() || 'all products';
        const settledQuery = catalogState.searchQuery.trim() || 'all products';
        const categoryKey = catalogState.selectedCategory ?? 'all';

        return catalogState.isSearchLoading
            ? `loading: draft_query="${draftQuery}"; settled_query="${settledQuery}"; category_key="${categoryKey}"; visible_products and catalog_window still describe the settled shelf`
            : `idle: settled_query="${settledQuery}"; category_key="${categoryKey}"; visible_products and catalog_window describe this settled shelf`;
    }, [
        catalogState.isSearchLoading,
        catalogState.searchQuery,
        catalogState.searchText,
        catalogState.selectedCategory,
    ]);

    const cartSummaryText = useMemo(() => {
        if (cartStateHook.cartLines.length === 0) {
            return 'empty';
        }

        const subtotalText =
            cartStateHook.cartSummary.subtotal === null
                ? 'mixed pricing'
                : `৳${cartStateHook.cartSummary.subtotal.toLocaleString('en-US')}`;
        const lineSummary = cartStateHook.cartLines
            .slice(0, 8)
            .map(
                (line) =>
                    `#${line.productId} ${line.title} x${line.quantity}`,
            )
            .join(' | ');
        const remainder =
            cartStateHook.cartLines.length > 8
                ? ` | +${cartStateHook.cartLines.length - 8} more`
                : '';

        return `${cartStateHook.cartSummary.totalItems} items, subtotal ${subtotalText}. ${lineSummary}${remainder}`;
    }, [
        cartStateHook.cartLines,
        cartStateHook.cartSummary.subtotal,
        cartStateHook.cartSummary.totalItems,
    ]);

    // ── Shared choreography helpers ──────────────────────────────

    const commitSearchQuery = async (
        nextQuery: string,
        signal?: AbortSignal,
    ): Promise<TAnimateSearchResult> => {
        const committedQuery = nextQuery.trim();
        catalogState.applySearchValue(committedQuery);
        await catalogState.waitForSearchToSettle(signal);

        const filteredMatches = getFilteredProducts(
            catalogState.catalog,
            catalogState.selectedCategoryRef.current,
            catalogState.searchQueryRef.current,
        );
        const visibleResults = buildVisibleSearchResults(
            filteredMatches.slice(0, MAX_VISIBLE_PRODUCTS),
            cartStateHook.cartQuantitiesRef.current,
        );
        const addableMatches = filteredMatches.filter(
            (product) => product.price !== null,
        );
        return {
            appliedQuery: catalogState.searchQueryRef.current.trim(),
            resultCount: addableMatches.length,
            visibleResults,
        };
    };

    const applyCategorySelection = async (
        categoryKey: string | null,
        signal?: AbortSignal,
    ): Promise<TCategoryResult> => {
        const button =
            categoryKey === null
                ? refs.allCategoryButton.current
                : (refs.categoryButtons.current.get(categoryKey) ?? null);

        setActiveUiTarget(categoryTarget(categoryKey));
        cursor.setCursorMode(
            'browse',
            categoryKey === null ? 'show all aisles' : 'browse aisle',
        );
        await scrollReveal.revealCategoryButton(button, signal);
        await cursor.moveCursorToElement(button, signal, 220);
        await cursor.pulseCursor(signal);

        catalogState.selectCategory(categoryKey);
        await waitForUi(signal, 80);

        return catalogState.getCategoryResult(
            categoryKey,
            catalogState.searchQueryRef.current,
        );
    };

    // ── animateSearch ────────────────────────────────────────────

    const animateSearch = async (
        input: z.infer<typeof animateSearchInputSchema>,
        signal?: AbortSignal,
    ): Promise<TAnimateSearchResult> => {
        if (!catalogState.catalog) {
            return {appliedQuery: '', resultCount: 0, visibleResults: []};
        }

        catalogState.setSearchIsAnimating(true);

        try {
            if (
                input.categoryKey !== undefined &&
                input.categoryKey !== catalogState.selectedCategoryRef.current
            ) {
                await applyCategorySelection(
                    input.categoryKey ?? null,
                    signal,
                );
            }

            setActiveUiTarget(searchPanelTarget());
            cursor.setCursorMode('search', 'refine search');
            await scrollReveal.scrollSearchAreaIntoView(signal);
            await cursor.moveCursorToElement(
                refs.searchInput.current,
                signal,
                160,
            );
            refs.searchInput.current?.focus();
            await cursor.pulseCursor(signal);

            // Backspace existing text
            const backspaceSteps = Array.from(
                {length: catalogState.searchTextRef.current.length},
                (_, i) =>
                    catalogState.searchTextRef.current.slice(
                        0,
                        catalogState.searchTextRef.current.length - i - 1,
                    ),
            );

            for (const step of backspaceSteps) {
                catalogState.applySearchValue(step);
                await wait(
                    Math.max(4, SEARCH_TYPING_BASE_MS - 2),
                    signal,
                );
            }

            // Type new query
            const typeSteps = Array.from(
                {length: input.query.length},
                (_, i) => input.query.slice(0, i + 1),
            );

            for (const step of typeSteps) {
                catalogState.applySearchValue(step);
                await wait(SEARCH_TYPING_BASE_MS, signal);
            }

            const result = await commitSearchQuery(input.query, signal);
            const leadingVisibleResult = result.visibleResults[0] ?? null;
            if (leadingVisibleResult) {
                await scrollReveal.revealCatalogResults(signal);
                await scrollReveal.revealElement(
                    refs.productCards.current.get(
                        leadingVisibleResult.productId,
                    ) ?? null,
                    'center',
                    signal,
                );
                flashProducts([leadingVisibleResult.productId], 1450);
            }

            return result;
        } finally {
            catalogState.setSearchIsAnimating(false);
            hideCursorAndTarget();
        }
    };

    // ── ensureProductVisible ─────────────────────────────────────

    const ensureProductVisible = async (
        product: {
            readonly id: number;
            readonly title: string;
            readonly subtitle: string;
            readonly primaryCategoryKey: string | null;
        },
        signal?: AbortSignal,
    ) => {
        const revealFirstWindow = async () => {
            if (catalogState.visibleStartIndexRef.current === 0) {
                await nextFrame(signal);
                return;
            }

            startTransition(() => {
                catalogState.setVisibleStartIndex(0);
            });
            await waitForUi(signal, 80);
        };

        if (catalogState.isProductInFirstWindow(product.id)) {
            await revealFirstWindow();
            return true;
        }

        const searchPlans = [
            {
                categoryKey: product.primaryCategoryKey ?? null,
                query: product.title,
            },
            {
                categoryKey: product.primaryCategoryKey ?? null,
                query: `${product.title} ${product.subtitle}`.trim(),
            },
            {categoryKey: null, query: product.title},
            {
                categoryKey: null,
                query: `${product.title} ${product.subtitle}`.trim(),
            },
        ].filter(
            (plan, index, allPlans) =>
                allPlans.findIndex(
                    (candidate) =>
                        candidate.categoryKey === plan.categoryKey &&
                        candidate.query === plan.query,
                ) === index,
        );

        for (const plan of searchPlans) {
            await animateSearch(
                {query: plan.query, categoryKey: plan.categoryKey},
                signal,
            );

            if (
                catalogState.isProductInFirstWindow(
                    product.id,
                    plan.categoryKey,
                    plan.query,
                )
            ) {
                await revealFirstWindow();
                return true;
            }
        }

        return false;
    };

    // ── performCartMutation ──────────────────────────────────────

    const performCartMutation = async (
        mutation: TCartMutation,
        signal?: AbortSignal,
    ) => {
        if (!catalogState.catalog) {
            return {
                summary: cartStateHook.cartSummary,
                touchedProductIds: [] as readonly number[],
            };
        }

        const product = catalogState.catalog.productMap.get(
            mutation.productId,
        );
        if (!product) {
            throw new Error(`Unknown product id: ${mutation.productId}`);
        }

        if (mutation.quantityDelta > 0 && product.price === null) {
            return {
                summary: cartStateHook.cartSummary,
                touchedProductIds: [] as readonly number[],
            };
        }

        const quantityInCart =
            cartStateHook.cartQuantitiesRef.current[product.id] ?? 0;

        try {
            if (quantityInCart > 0) {
                setActiveUiTarget(cartLineTarget(product.id));
                cursor.setCursorMode(
                    'cart',
                    mutation.quantityDelta > 0
                        ? 'update basket'
                        : 'trim basket',
                );
                await scrollReveal.revealCartLine(product.id, signal, {
                    openIfNeeded: true,
                });
                await cursor.moveCursorToElement(
                    refs.cartLines.current.get(product.id) ??
                        refs.cartPanel.current,
                    signal,
                    180,
                );
                await cursor.pulseCursor(signal);

                const result = cartStateHook.applyCartMutations([mutation]);
                flashProducts(result.touchedProductIds);
                cartStateHook.pulseCartFab();
                await waitForUi(signal, 60);

                return {
                    summary: result.summary,
                    touchedProductIds: result.touchedProductIds,
                };
            }

            if (mutation.quantityDelta < 0) {
                return {
                    summary: cartStateHook.cartSummary,
                    touchedProductIds: [] as readonly number[],
                };
            }

            await ensureProductVisible(product, signal);
            const productCard =
                refs.productCards.current.get(product.id) ?? null;

            if (productCard) {
                setActiveUiTarget(productTarget(product.id));
                cursor.setCursorMode('cart', 'add from shelf');
                await scrollReveal.revealElement(
                    productCard,
                    'center',
                    signal,
                );
                await cursor.moveCursorToElement(productCard, signal, 200);
                await cursor.pulseCursor(signal);
            }

            const result = cartStateHook.applyCartMutations([mutation]);
            flashProducts(result.touchedProductIds);
            cartStateHook.pulseCartFab();
            await waitForUi(signal, 60);

            if (result.addedProductIds.length > 0) {
                setActiveUiTarget(cartLineTarget(product.id));
                cursor.setCursorMode('cart', 'review basket');
                await scrollReveal.revealCartLine(product.id, signal, {
                    openIfNeeded: true,
                });
                await cursor.moveCursorToElement(
                    refs.cartLines.current.get(product.id) ??
                        refs.cartPanel.current,
                    signal,
                    160,
                );
            }

            return {
                summary: result.summary,
                touchedProductIds: result.touchedProductIds,
            };
        } finally {
            hideCursorAndTarget();
        }
    };

    const runCartMutation = async (
        input: z.infer<typeof cartInputSchema>,
        signal?: AbortSignal,
    ): Promise<TCartResult> => {
        const result = await performCartMutation(input, signal);
        return {
            totalItems: result.summary.totalItems,
            subtotal: result.summary.subtotal,
        };
    };

    // ── scrollCatalogWindow ──────────────────────────────────────

    const scrollCatalogWindow = async (
        input: z.infer<typeof scrollCatalogInputSchema>,
        signal?: AbortSignal,
    ): Promise<TCatalogWindow> => {
        if (!catalogState.catalog) {
            return buildCatalogWindow([], 0);
        }

        await catalogState.waitForSearchToSettle(signal);

        try {
            const pageCount = Math.max(1, input.pages ?? 1);
            let currentStart = catalogState.visibleStartIndexRef.current;
            let currentFiltered = getFilteredProducts(
                catalogState.catalog,
                catalogState.selectedCategoryRef.current,
                catalogState.searchQueryRef.current,
            );

            const pageSteps = Array.from({length: pageCount});
            for (const _ of pageSteps) {
                const nextStart = clampWindowStart(
                    currentStart +
                        (input.direction === 'next'
                            ? MAX_VISIBLE_PRODUCTS
                            : -MAX_VISIBLE_PRODUCTS),
                    currentFiltered.length,
                );

                if (nextStart === currentStart) {
                    break;
                }

                setActiveUiTarget(windowNavTarget(input.direction));
                cursor.setCursorMode(
                    'browse',
                    input.direction === 'next'
                        ? 'next results'
                        : 'previous results',
                );
                await scrollReveal.revealElement(
                    refs.gridWindowNav.current ?? refs.gridSection.current,
                    'bottom',
                    signal,
                );
                await cursor.moveCursorToElement(
                    input.direction === 'next'
                        ? (refs.nextWindowButton.current ??
                              refs.gridWindowNav.current ??
                              refs.gridSection.current)
                        : (refs.previousWindowButton.current ??
                              refs.gridWindowNav.current ??
                              refs.gridSection.current),
                    signal,
                    220,
                );
                await cursor.pulseCursor(signal);

                currentStart = nextStart;
                startTransition(() => {
                    catalogState.setVisibleStartIndex(nextStart);
                });

                await waitForUi(signal, 90);
                await scrollReveal.revealCatalogResults(signal);

                currentFiltered = getFilteredProducts(
                    catalogState.catalog,
                    catalogState.selectedCategoryRef.current,
                    catalogState.searchQueryRef.current,
                );
            }

            return buildCatalogWindow(currentFiltered, currentStart);
        } finally {
            hideCursorAndTarget();
        }
    };

    // ── Register agent variables ─────────────────────────────────

    useAgentVariable('search_status', {
        schema: searchStatusSchema,
        value: searchStatusSummary,
    });

    useAgentVariable('featured_categories', {
        schema: featuredCategorySchema,
        value: featuredCategorySummary,
    });

    useAgentVariable('visible_products', {
        schema: visibleProductCardSchema,
        value: visibleSearchResults,
    });

    useAgentVariable('catalog_window', {
        schema: catalogWindowSummarySchema,
        value: catalogWindowSummary,
    });

    useAgentVariable('cart_summary', {
        schema: cartSummarySchema,
        value: cartSummaryText,
    });

    // ── Register agent functions ─────────────────────────────────

    useAgentFunction('animateSearch', {
        inputSchema: animateSearchInputSchema,
        outputSchema: animateSearchOutputSchema,
        mutationTimeoutMs: AGENT_MUTATION_TIMEOUT_MS,
        mutates: ['search_status', 'visible_products', 'catalog_window'],
        func: animateSearch,
    });

    useAgentFunction('setCategory', {
        inputSchema: categorySelectionSchema,
        outputSchema: categorySelectionOutputSchema,
        mutationTimeoutMs: AGENT_MUTATION_TIMEOUT_MS,
        mutates: ['search_status', 'visible_products', 'catalog_window'],
        func: async (
            input: z.infer<typeof categorySelectionSchema>,
            signal?: AbortSignal,
        ) => {
            try {
                return await applyCategorySelection(
                    input.categoryKey,
                    signal,
                );
            } finally {
                hideCursorAndTarget();
            }
        },
    });

    useAgentFunction('updateCart', {
        inputSchema: cartInputSchema,
        outputSchema: cartOutputSchema,
        mutationTimeoutMs: AGENT_MUTATION_TIMEOUT_MS,
        mutates: ['cart_summary', 'visible_products'],
        func: async (
            input: z.infer<typeof cartInputSchema>,
            signal?: AbortSignal,
        ) => await runCartMutation(input, signal),
    });

    useAgentFunction('scrollCatalog', {
        inputSchema: scrollCatalogInputSchema,
        outputSchema: catalogWindowSchema,
        mutationTimeoutMs: AGENT_MUTATION_TIMEOUT_MS,
        mutates: ['visible_products', 'catalog_window'],
        func: scrollCatalogWindow,
    });

    return {
        activeUiTarget,
        serializedTarget,
        setActiveUiTarget,
        systemPrompt,
        chatTheme,
    } as const;
};
