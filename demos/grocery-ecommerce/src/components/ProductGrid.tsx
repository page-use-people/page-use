import {memo} from 'react';
import {ProductCard} from './ProductCard.tsx';
import {useRegistryCallbacks} from '../contexts/element-registry-context.ts';
import {useAgentTarget} from '../contexts/agent-target-context.ts';
import type {TCatalogProduct} from '../lib/catalog.ts';

type TProductGridProps = {
    readonly isLoading: boolean;
    readonly isSearchLoading: boolean;
    readonly selectedCategoryLabel: string;
    readonly visibleProducts: readonly TCatalogProduct[];
    readonly cartQuantities: Readonly<Record<number, number>>;
    readonly highlightedProductIds: ReadonlySet<number>;
    readonly onAdjustCart: (productId: number, delta: number) => void;
};

export const ProductGrid = memo(
    ({
        isLoading,
        isSearchLoading,
        selectedCategoryLabel,
        visibleProducts,
        cartQuantities,
        highlightedProductIds,
        onAdjustCart,
    }: TProductGridProps) => {
        const {registerGridSection, registerGridHeading, registerProductCard} =
            useRegistryCallbacks();
        const activeUiTarget = useAgentTarget();

        return (
            <section
                ref={registerGridSection}
                className="min-w-0 rounded-2xl bg-white p-2 max-md:rounded-xl">
                <div
                    ref={registerGridHeading}
                    className="mb-2 flex min-w-0 items-end justify-between gap-4">
                    <div className="grid gap-0.5">
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
                    <div className="grid min-w-0 gap-2 grid-cols-3">
                        {Array.from({length: 8}, (_, index) => (
                            <div
                                key={index}
                                className="grid gap-3 overflow-hidden rounded-2xl bg-white p-3">
                                <div className="grid min-h-36 place-items-center rounded-2xl bg-neutral-100 px-1 py-3">
                                    <div className="h-28 w-28 rounded-3xl bg-white animate-pulse" />
                                </div>
                                <div className="grid gap-2">
                                    <div className="h-3.5 w-2/5 rounded-full bg-neutral-200 animate-pulse" />
                                    <div className="h-4.5 w-4/5 rounded-full bg-neutral-200 animate-pulse" />
                                    <div className="h-4 w-3/5 rounded-full bg-neutral-200 animate-pulse" />
                                </div>
                                <div className="mt-1 flex items-center justify-between gap-3">
                                    <div className="h-5 w-20 rounded-full bg-neutral-200 animate-pulse" />
                                    <div className="h-10 w-28 rounded-full bg-neutral-100 animate-pulse" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : visibleProducts.length > 0 ? (
                    <div className="grocery-product-grid grid min-w-0 gap-2 grid-cols-3">
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
                                    registerProductCard(product.id, node);
                                }}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="grid min-h-52 place-items-center gap-2 rounded-2xl bg-white px-4 py-9 text-center">
                        <h3 className="text-[clamp(1.5rem,3vw,2rem)] font-semibold">
                            No products found
                        </h3>
                    </div>
                )}
            </section>
        );
    },
    (prev, next) =>
        prev.isLoading === next.isLoading &&
        prev.isSearchLoading === next.isSearchLoading &&
        prev.selectedCategoryLabel === next.selectedCategoryLabel &&
        prev.visibleProducts === next.visibleProducts &&
        prev.cartQuantities === next.cartQuantities &&
        prev.highlightedProductIds === next.highlightedProductIds,
);

ProductGrid.displayName = 'ProductGrid';
