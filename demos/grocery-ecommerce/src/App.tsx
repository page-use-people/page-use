import {PageUseChat} from '@page-use/react/ui/chat';
import {SystemPrompt} from '@page-use/react';
import {ElementRegistryContext} from './contexts/element-registry-context.ts';
import {AgentTargetContext} from './contexts/agent-target-context.ts';
import {useElementRegistry} from './hooks/use-element-registry.ts';
import {useCatalogState} from './hooks/use-catalog-state.ts';
import {useCartState} from './hooks/use-cart-state.ts';
import {useCursorAnimation} from './hooks/use-cursor-animation.ts';
import {useScrollReveal} from './hooks/use-scroll-reveal.ts';
import {useProductHighlight} from './hooks/use-product-highlight.ts';
import {useAgentIntegration} from './hooks/use-agent-integration.ts';
import {AppShell} from './components/AppShell.tsx';
import {CatalogBrowser} from './components/CatalogBrowser.tsx';
import {CartPanel} from './components/CartPanel.tsx';
import {CategoryNav} from './components/CategoryNav.tsx';
import {FauxCursor} from './components/FauxCursor.tsx';
import {AgentStatusBadge} from './components/AgentStatusBadge.tsx';
import {waitForUi} from './lib/async-animation.ts';

const App = () => {
    const {refs, callbacks} = useElementRegistry();
    const catalogState = useCatalogState();
    const cartState = useCartState(catalogState.catalog);
    const cursor = useCursorAnimation(refs);
    const scrollReveal = useScrollReveal(refs);
    const {highlightedProductIds, flashProducts} = useProductHighlight();
    const agent = useAgentIntegration(
        catalogState,
        cartState,
        refs,
        cursor,
        scrollReveal,
        flashProducts,
    );

    // ── Derived layout state ────────────────────────────────────

    const loadingState = catalogState.isCatalogLoading
        ? ('catalog' as const)
        : catalogState.isSearchLoading
          ? ('search' as const)
          : ('idle' as const);

    // ── Manual interaction handlers ─────────────────────────────

    const handleProductAdjust = (productId: number, delta: number) => {
        const result = cartState.applyCartMutations([
            {productId, quantityDelta: delta},
        ]);
        if (result.touchedProductIds.length > 0) {
            flashProducts(result.touchedProductIds);
        }
        if (delta > 0 && result.addedProductIds.length > 0) {
            void scrollReveal.revealCartLine(productId);
        }
    };

    const handleCartAdjust = (productId: number, delta: number) => {
        const result = cartState.applyCartMutations([
            {productId, quantityDelta: delta},
        ]);
        if (result.touchedProductIds.length > 0) {
            flashProducts(result.touchedProductIds);
        }
    };

    const goToPreviousPage = () => {
        catalogState.goToPage('previous');
        void (async () => {
            await waitForUi(undefined, 120);
            await scrollReveal.revealCatalogResults(undefined);
        })();
    };

    const goToNextPage = () => {
        catalogState.goToPage('next');
        void (async () => {
            await waitForUi(undefined, 120);
            await scrollReveal.revealCatalogResults(undefined);
        })();
    };

    // ── Render ──────────────────────────────────────────────────

    return (
        <>
            <SystemPrompt>{agent.systemPrompt}</SystemPrompt>

            <ElementRegistryContext.Provider value={callbacks}>
                <AgentTargetContext.Provider value={agent.serializedTarget}>
                    <AppShell
                        sidebar={
                            <CategoryNav
                                selectedCategory={catalogState.selectedCategory}
                                featuredCategories={
                                    catalogState.featuredCategories
                                }
                                onSelectAllAisles={() =>
                                    catalogState.selectCategory(null)
                                }
                                onSelectCategory={catalogState.selectCategory}
                            />
                        }
                        cart={
                            catalogState.catalog ? (
                                <CartPanel
                                    cartLines={cartState.cartLines}
                                    totalItems={
                                        cartState.cartSummary.totalItems
                                    }
                                    subtotal={cartState.cartSummary.subtotal}
                                    onAdjustCart={handleCartAdjust}
                                />
                            ) : null
                        }>
                        <CatalogBrowser
                            searchDraft={catalogState.searchText}
                            searchIsAnimating={catalogState.searchIsAnimating}
                            loadingState={loadingState}
                            searchAppliedQuery={catalogState.searchQuery}
                            selectedCategoryLabel={
                                catalogState.selectedCategoryLabel
                            }
                            visibleProducts={catalogState.visibleProducts}
                            catalogWindow={catalogState.catalogWindow}
                            cartQuantities={cartState.cartQuantities}
                            highlightedProductIds={highlightedProductIds}
                            onSearchDraftChange={catalogState.applySearchValue}
                            onAdjustCart={handleProductAdjust}
                            onPreviousPage={goToPreviousPage}
                            onNextPage={goToNextPage}
                        />
                    </AppShell>

                    <AgentStatusBadge agentAction={cursor.agentAction} />
                    <FauxCursor ref={refs.cursor} labelRef={refs.cursorLabel} />
                </AgentTargetContext.Provider>
            </ElementRegistryContext.Provider>

            <PageUseChat
                title="ATELIER MARKET GUIDE"
                greeting="Ask for ingredients, Bangladeshi staples, better product matches, or exact items to add to cart."
                placeholder="Ask for recipe ingredients, compare brands, browse aisles, or add exact items to cart"
                suggestions={[
                    "I'm making fried chicken tonight.",
                    'Add Greek yogurt, granola, and blueberries.',
                    'Find a good salted butter and add it.',
                ]}
                theme="light"
                roundedness="lg"
                expandedPlacement="bottom-left"
                cssVariables={agent.chatTheme}
                devMode
            />
        </>
    );
};

export default App;
