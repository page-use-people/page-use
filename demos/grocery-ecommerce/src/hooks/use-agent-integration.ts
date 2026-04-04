import {startTransition, useMemo, useState} from 'react';
import {
    useAgentFunction,
    useAgentVariable,
    z,
} from '@page-use/react';
import type {TElementRegistry} from './use-element-registry.ts';
import type {TCursorAnimation} from './use-cursor-animation.ts';
import type {TScrollReveal} from './use-scroll-reveal.ts';
import type {TCatalogState} from './use-catalog-state.ts';
import {buildVisibleSearchResults} from './use-catalog-state.ts';
import type {TCartState as TCartStateHook} from './use-cart-state.ts';
import {
    type TUITarget,
    serializeUITarget,
    searchPanelTarget,
    productTarget,
    cartLineTarget,
} from '../types/ui-target.ts';
import {
    MAX_VISIBLE_PRODUCTS,
    SEARCH_TYPING_BASE_MS,
    getFilteredProducts,
    type TAnimateSearchResult,
} from '../lib/catalog-browser.ts';
import {wait} from '../lib/catalog.ts';
import {waitForUi, nextFrame} from '../lib/async-animation.ts';
import {
    animateSearchInputSchema,
    animateSearchOutputSchema,
    cartInputSchema,
    cartOutputSchema,
    cartSummarySchema,
    chatTheme,
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

    const visibleSearchResults = useMemo(
        () =>
            buildVisibleSearchResults(
                catalogState.visibleProducts,
                cartStateHook.cartQuantities,
            ),
        [cartStateHook.cartQuantities, catalogState.visibleProducts],
    );

    const searchStatusSummary = useMemo(() => {
        const draftQuery = catalogState.searchText.trim() || 'all products';
        const settledQuery = catalogState.searchQuery.trim() || 'all products';

        return catalogState.isSearchLoading
            ? `loading: draft_query="${draftQuery}"; settled_query="${settledQuery}"; visible_products still describes the settled shelf`
            : `idle: settled_query="${settledQuery}"; visible_products describes this settled shelf`;
    }, [
        catalogState.isSearchLoading,
        catalogState.searchQuery,
        catalogState.searchText,
    ]);

    const cartSummaryText = useMemo(() => {
        if (cartStateHook.cartLines.length === 0) {
            return 'empty';
        }

        const subtotalText =
            cartStateHook.cartSummary.subtotal === null
                ? 'mixed pricing'
                : cartStateHook.cartSummary.subtotal.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
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

        const searchQueries = [
            product.title,
            `${product.title} ${product.subtitle}`.trim(),
        ].filter(
            (query, index, all) => all.indexOf(query) === index,
        );

        for (const query of searchQueries) {
            await animateSearch({query}, signal);

            if (
                catalogState.isProductInFirstWindow(
                    product.id,
                    null,
                    query,
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
                await scrollReveal.revealCartLine(product.id, signal);
                await cursor.moveCursorToElement(
                    refs.cartLines.current.get(product.id) ??
                        refs.cartPanel.current,
                    signal,
                    180,
                );
                await cursor.pulseCursor(signal);

                const result = cartStateHook.applyCartMutations([mutation]);
                flashProducts(result.touchedProductIds);
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
            await waitForUi(signal, 60);

            if (result.addedProductIds.length > 0) {
                setActiveUiTarget(cartLineTarget(product.id));
                cursor.setCursorMode('cart', 'review basket');
                await scrollReveal.revealCartLine(product.id, signal);
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

    // ── Register agent variables ─────────────────────────────────

    useAgentVariable('search_status', {
        schema: searchStatusSchema,
        value: searchStatusSummary,
    });

    useAgentVariable('visible_products', {
        schema: visibleProductCardSchema,
        value: visibleSearchResults,
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
        mutates: ['search_status', 'visible_products'],
        func: animateSearch,
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

    return {
        activeUiTarget,
        serializedTarget,
        setActiveUiTarget,
        systemPrompt,
        chatTheme,
    } as const;
};
