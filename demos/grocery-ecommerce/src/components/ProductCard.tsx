import {memo, useEffect, useRef} from 'react';
import {formatPrice, type TCatalogProduct} from '../lib/catalog.ts';

const hexToRGBA = (hex: string, alpha: number) => {
    const n = parseInt(hex.replace('#', ''), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};

type TProductCardProps = {
    readonly product: TCatalogProduct;
    readonly quantityInCart: number;
    readonly isHighlighted: boolean;
    readonly isAgentActive: boolean;
    readonly onAdjustCart: (delta: number) => void;
    readonly registerRef: (node: HTMLElement | null) => void;
};

export const ProductCard = memo(
    ({
        product,
        quantityInCart,
        isHighlighted,
        isAgentActive,
        onAdjustCart,
        registerRef,
    }: TProductCardProps) => {
        const previousQuantityRef = useRef(quantityInCart);
        const rootRef = useRef<HTMLElement | null>(null);
        const hasRenderedRef = useRef(false);
        const hasRenderedBefore = hasRenderedRef.current;

        if (!hasRenderedRef.current) {
            hasRenderedRef.current = true;
        }

        useEffect(() => {
            const previousQuantity = previousQuantityRef.current;
            previousQuantityRef.current = quantityInCart;

            if (previousQuantity === quantityInCart) {
                return;
            }

            const root = rootRef.current;
            if (!root) {
                return;
            }

            const nextPulse =
                quantityInCart > previousQuantity ? 'add' : 'remove';
            root.dataset.pulse = 'false';
            void root.offsetWidth;
            root.dataset.pulse = nextPulse;

            const timer = window.setTimeout(() => {
                root.dataset.pulse = 'false';
            }, 720);

            return () => {
                window.clearTimeout(timer);
            };
        }, [quantityInCart]);

        return (
            <article
                ref={(node) => {
                    rootRef.current = node;
                    registerRef(node);
                }}
                className="group relative grid gap-1.5 overflow-hidden rounded-xl bg-white p-2 transition-transform duration-200 ease-out hover:-translate-y-1 data-[agent-active=true]:-translate-y-1 data-[highlighted=true]:-translate-y-1 data-[highlighted=true]:animate-[grocery-product-pulse_900ms_ease-out_1] data-[pulse=add]:animate-[grocery-product-pop_560ms_cubic-bezier(0.2,0.9,0.2,1)] data-[pulse=remove]:animate-[grocery-product-pop-down_520ms_cubic-bezier(0.2,0.9,0.2,1)]"
                data-in-cart={quantityInCart > 0 ? 'true' : 'false'}
                data-highlighted={isHighlighted ? 'true' : 'false'}
                data-agent-active={isAgentActive ? 'true' : 'false'}
                data-pulse="false"
                data-cached={hasRenderedBefore ? 'true' : 'false'}>
                <div
                    className="grid aspect-square place-items-center overflow-hidden rounded-xl shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]"
                    style={
                        {
                            '--c-v': product.theme.vibrant,
                            '--c-m': product.theme.muted,
                            '--c-dv': product.theme.darkVibrant,
                            '--c-dm': product.theme.darkMuted,
                            '--c-lv': product.theme.lightVibrant,
                            '--c-lm': product.theme.lightMuted,
                            '--c-shell': hexToRGBA(
                                product.theme.lightMuted,
                                0.18,
                            ),
                            backgroundImage:
                                'radial-gradient(circle at top, rgba(255, 255, 255, 0.8), transparent 56%), linear-gradient(180deg, color-mix(in srgb, var(--c-lv) 38%, rgba(248, 241, 233, 0.98)), color-mix(in srgb, var(--c-shell) 18%, rgba(243, 235, 226, 0.94)))',
                        } as React.CSSProperties
                    }
                    aria-hidden="true">
                    <img
                        src={product.imageUrl}
                        alt={product.title}
                        loading={hasRenderedBefore ? 'eager' : 'lazy'}
                        className="relative w-[90%] object-contain transition-transform duration-200 ease-out group-hover:-translate-y-0.5 group-hover:scale-[1.02] group-data-[cached=false]:animate-[grocery-image-settle_420ms_ease-out_both]"
                    />
                </div>

                <div className="grid gap-1 px-2">
                    <h3 className="m-0 line-clamp-2 text-sm leading-tight text-[#201712] font-bold">
                        {product.title}
                    </h3>

                    <p className="m-0 line-clamp-2 text-xs text-[#201712]/[0.56]">
                        {product.subtitle}
                    </p>

                    <div className="flex items-center justify-between gap-3 pr-px pb-0.5 max-sm:flex-col max-sm:items-start">
                        <div className="grid">
                            <strong className="text-base text-[#201712]">
                                {formatPrice(product.price)}
                            </strong>
                        </div>

                        {quantityInCart === 0 ? (
                            <button
                                type="button"
                                className="flex min-h-8 items-center justify-center rounded-full bg-[var(--g-accent-strong)] px-3.5 py-1 text-xs font-bold text-[var(--g-on-accent)] transition-[transform,background,opacity] duration-200 ease-out hover:-translate-y-0.5 hover:bg-[var(--g-accent)] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-accent)]/40 focus-visible:ring-offset-2"
                                aria-label={`Add ${product.title} to cart`}
                                disabled={product.price === null}
                                onClick={() => {
                                    onAdjustCart(1);
                                }}>
                                Add
                            </button>
                        ) : (
                            <div
                                className="inline-grid grid-flow-col auto-cols-min items-center gap-1 rounded-full bg-white p-0.5"
                                aria-label="Cart actions">
                                <button
                                    type="button"
                                    className="flex min-h-8 w-8 items-center justify-center rounded-full bg-[var(--g-accent-strong)] p-0 text-base font-bold leading-none text-[var(--g-on-accent)] transition-[transform,background,opacity] duration-200 ease-out hover:-translate-y-0.5 hover:bg-[var(--g-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-accent)]/40 focus-visible:ring-offset-2"
                                    aria-label={`Remove one ${product.title}`}
                                    onClick={() => {
                                        onAdjustCart(-1);
                                    }}>
                                    -
                                </button>
                                <span className="min-w-6 text-center text-xs font-bold text-[#201712]">
                                    {quantityInCart}
                                </span>
                                <button
                                    type="button"
                                    className="flex min-h-8 w-8 items-center justify-center rounded-full bg-[var(--g-accent-strong)] p-0 text-base font-bold leading-none text-[var(--g-on-accent)] transition-[transform,background,opacity] duration-200 ease-out hover:-translate-y-0.5 hover:bg-[var(--g-accent)] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-accent)]/40 focus-visible:ring-offset-2"
                                    aria-label={`Add one more ${product.title}`}
                                    disabled={product.price === null}
                                    onClick={() => {
                                        onAdjustCart(1);
                                    }}>
                                    +
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </article>
        );
    },
    (previousProps, nextProps) =>
        previousProps.product === nextProps.product &&
        previousProps.quantityInCart === nextProps.quantityInCart &&
        previousProps.isHighlighted === nextProps.isHighlighted &&
        previousProps.isAgentActive === nextProps.isAgentActive,
);

ProductCard.displayName = 'ProductCard';
