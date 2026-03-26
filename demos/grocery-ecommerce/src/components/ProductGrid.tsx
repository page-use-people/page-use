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
                className="min-w-0 rounded-[1.8rem] bg-white p-[1.1rem] max-[760px]:rounded-[1.35rem]">
                <div
                    ref={registerGridHeading}
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
                    <div className="grid min-w-0 gap-[0.85rem] grid-cols-3 max-[1320px]:grid-cols-2 max-[560px]:grid-cols-1">
                        {Array.from({length: 8}, (_, index) => (
                            <div
                                key={index}
                                className="grid gap-[0.72rem] overflow-hidden rounded-[1.22rem] bg-white p-[0.78rem]">
                                <div className="grid min-h-[8.75rem] place-items-center rounded-[1rem] bg-[#f5f5f5] px-[0.3rem] py-[0.72rem]">
                                    <div className="h-[6.6rem] w-[6.6rem] rounded-[1.4rem] bg-white animate-pulse" />
                                </div>
                                <div className="grid gap-[0.45rem]">
                                    <div className="h-3.5 w-2/5 rounded-full bg-[#eee] animate-pulse" />
                                    <div className="h-4.5 w-4/5 rounded-full bg-[#e5e5e5] animate-pulse" />
                                    <div className="h-4 w-3/5 rounded-full bg-[#eee] animate-pulse" />
                                </div>
                                <div className="mt-1 flex items-center justify-between gap-3">
                                    <div className="h-5 w-20 rounded-full bg-[#eee] animate-pulse" />
                                    <div className="h-10 w-28 rounded-full bg-[#f5f5f5] animate-pulse" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : visibleProducts.length > 0 ? (
                    <div className="grocery-product-grid grid min-w-0 gap-[0.85rem] grid-cols-3 max-[1320px]:grid-cols-2 max-[560px]:grid-cols-1">
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
                    <div className="grid min-h-[13rem] place-items-center gap-[0.45rem] rounded-[1.2rem] bg-white px-[1.1rem] py-[2.25rem] text-center">
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
