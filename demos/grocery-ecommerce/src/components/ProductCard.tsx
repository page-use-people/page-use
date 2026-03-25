import {memo, useEffect, useMemo, useRef, type CSSProperties} from 'react';
import {formatPrice, type TCatalogProduct} from '../lib/catalog.ts';

const renderedProductIdsCache = new Set<number>();
const productStyleCache = new Map<number, CSSProperties>();

type TProductCardProps = {
    readonly product: TCatalogProduct;
    readonly quantityInCart: number;
    readonly isHighlighted: boolean;
    readonly isAgentActive: boolean;
    readonly onAdjustCart: (delta: number) => void;
    readonly registerRef: (node: HTMLElement | null) => void;
};

const getProductCardStyle = (product: TCatalogProduct) => {
    const cachedStyle = productStyleCache.get(product.id);
    if (cachedStyle) {
        return cachedStyle;
    }

    const nextStyle = {
        '--product-accent': product.theme.accent,
        '--product-support': product.theme.support,
        '--product-deep': product.theme.deep,
        '--product-soft': product.theme.soft,
        '--product-shell': product.theme.shell,
        '--product-glow': product.theme.glow,
        backgroundImage:
            'radial-gradient(circle at top left, color-mix(in srgb, var(--product-accent) 24%, rgba(255, 255, 255, 0.96)) 0, color-mix(in srgb, var(--product-support) 12%, rgba(255, 255, 255, 0.96)) 30%, transparent 74%), linear-gradient(180deg, color-mix(in srgb, var(--product-shell) 52%, rgba(255, 255, 255, 0.94)), rgba(248, 242, 234, 0.94))',
    } as CSSProperties;

    productStyleCache.set(product.id, nextStyle);
    return nextStyle;
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
        const hasRenderedBefore = renderedProductIdsCache.has(product.id);
        const cardStyle = useMemo(
            () => getProductCardStyle(product),
            [product],
        );
        const categoryLabel = product.primaryCategoryLabel?.trim() ?? '';
        const showEyebrow = categoryLabel.length > 0 || quantityInCart > 0;

        if (!hasRenderedBefore) {
            renderedProductIdsCache.add(product.id);
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
                className="group relative grid gap-[0.72rem] overflow-hidden rounded-[1.22rem] border border-[#231914]/[0.08] p-[0.78rem] shadow-[inset_0_1px_rgba(255,255,255,0.9),0_18px_36px_rgba(62,40,26,0.06)] transition-[transform,box-shadow,border-color] duration-[220ms] ease-out hover:-translate-y-[3px] data-[agent-active=true]:-translate-y-[3px] data-[highlighted=true]:-translate-y-[3px] data-[highlighted=true]:animate-[grocery-product-pulse_900ms_ease-out_1] data-[pulse=add]:animate-[grocery-product-pop_560ms_cubic-bezier(0.2,0.9,0.2,1)] data-[pulse=remove]:animate-[grocery-product-pop-down_520ms_cubic-bezier(0.2,0.9,0.2,1)]"
                data-in-cart={quantityInCart > 0 ? 'true' : 'false'}
                data-highlighted={isHighlighted ? 'true' : 'false'}
                data-agent-active={isAgentActive ? 'true' : 'false'}
                data-pulse="false"
                data-cached={hasRenderedBefore ? 'true' : 'false'}
                style={{
                    ...cardStyle,
                    borderColor: isHighlighted
                        ? 'rgba(240, 192, 58, 0.88)'
                        : isAgentActive
                          ? 'color-mix(in srgb, var(--product-accent) 28%, rgba(35, 25, 20, 0.12))'
                          : undefined,
                    boxShadow: isHighlighted
                        ? 'inset 0 1px rgba(255,255,255,0.96), 0 0 0 0.34rem rgba(240,192,58,0.18), 0 24px 44px rgba(240,192,58,0.16)'
                        : quantityInCart > 0
                          ? 'inset 0 1px rgba(255,255,255,0.94), 0 0 0 0.18rem color-mix(in srgb, var(--product-accent) 14%, transparent), 0 24px 44px rgba(208,107,52,0.1)'
                          : isAgentActive
                            ? 'inset 0 1px rgba(255,255,255,0.92), 0 24px 44px color-mix(in srgb, var(--product-glow) 56%, rgba(208,107,52,0.13))'
                            : undefined,
                }}>
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-[-1px] rounded-[inherit] opacity-0 transition-opacity duration-[220ms] ease-out group-hover:opacity-100 group-data-[agent-active=true]:opacity-100 group-data-[highlighted=true]:opacity-100"
                    style={{
                        backgroundImage: isHighlighted
                            ? 'linear-gradient(135deg, rgba(255, 228, 118, 0.28), rgba(255, 255, 255, 0.06))'
                            : 'linear-gradient(135deg, color-mix(in srgb, var(--product-accent) 34%, rgba(255, 255, 255, 0.07)), color-mix(in srgb, var(--product-support) 24%, transparent))',
                    }}
                />

                <div
                    className="grid min-h-[8.75rem] place-items-center overflow-hidden rounded-[1rem] px-[0.3rem] pb-[0.72rem] pt-[0.45rem]"
                    aria-hidden="true"
                    style={{
                        backgroundImage:
                            'radial-gradient(circle at top, rgba(255, 255, 255, 0.97), transparent 56%), linear-gradient(180deg, color-mix(in srgb, var(--product-soft) 38%, rgba(248, 241, 233, 0.98)), color-mix(in srgb, var(--product-shell) 18%, rgba(243, 235, 226, 0.94)))',
                    }}>
                    <img
                        src={product.imageUrl}
                        alt={product.title}
                        loading={hasRenderedBefore ? 'eager' : 'lazy'}
                        className="relative w-full max-w-[7.4rem] max-h-[7.8rem] object-contain drop-shadow-[0_14px_24px_rgba(34,23,16,0.14)] transition-transform duration-[220ms] ease-out group-hover:-translate-y-0.5 group-hover:scale-[1.02] group-data-[cached=false]:animate-[grocery-image-settle_420ms_ease-out_both]"
                    />
                </div>

                <div className="grid gap-[0.32rem]">
                    {showEyebrow ? (
                        <div className="flex min-h-[1.2rem] items-center justify-between gap-[0.55rem]">
                            {categoryLabel.length > 0 ? (
                                <span className="text-[0.7rem] font-bold uppercase tracking-[0.08em] text-[#271c16]/[0.62]">
                                    {categoryLabel}
                                </span>
                            ) : null}
                            {quantityInCart > 0 ? (
                                <span
                                    className="rounded-full px-2 py-[0.2rem] text-[0.68rem] font-bold uppercase tracking-[0.08em] text-[#392112]/[0.84]"
                                    style={{
                                    backgroundColor:
                                            'color-mix(in srgb, var(--product-accent) 22%, rgba(255, 241, 226, 0.98))',
                                    }}>
                                    {quantityInCart} in cart
                                </span>
                            ) : null}
                        </div>
                    ) : null}

                    <h3
                        className="m-0 overflow-hidden text-[0.98rem] leading-[1.28] text-[#201712]"
                        style={
                            {
                                display: '-webkit-box',
                                WebkitBoxOrient: 'vertical',
                                WebkitLineClamp: 2,
                            } as CSSProperties
                        }>
                        {product.title}
                    </h3>
                    <p
                        className="m-0 overflow-hidden text-[0.8rem] text-[#201712]/[0.56]"
                        style={
                            {
                                display: '-webkit-box',
                                WebkitBoxOrient: 'vertical',
                                WebkitLineClamp: 2,
                            } as CSSProperties
                        }>
                        {product.subtitle}
                    </p>

                    <div className="flex items-center justify-between gap-3 pr-[0.08rem] pb-[0.14rem] max-[560px]:flex-col max-[560px]:items-start">
                        <div className="grid">
                            <strong className="text-[0.94rem] text-[#201712]">
                                {formatPrice(product.price)}
                            </strong>
                        </div>

                        <div
                            className="mb-[0.08rem] inline-grid grid-flow-col auto-cols-min items-center gap-[0.35rem] rounded-full bg-white/82 p-[0.24rem] shadow-[inset_0_1px_rgba(255,255,255,0.92)]"
                            aria-label="Cart actions">
                            <button
                                type="button"
                                className="flex min-h-[2.55rem] w-[2.55rem] items-center justify-center rounded-full border border-[#201712]/[0.08] bg-white/92 p-0 text-[1.05rem] font-bold leading-none text-[#201712]/[0.78] shadow-[0_14px_28px_rgba(35,22,16,0.12)] transition-[transform,box-shadow,background,opacity] duration-[220ms] ease-out enabled:hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-[0.42] disabled:transform-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d06b34]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#fbf7f2]"
                                aria-label={`Remove one ${product.title}`}
                                disabled={quantityInCart === 0}
                                onClick={() => {
                                    onAdjustCart(-1);
                                }}>
                                -
                            </button>
                            <span className="min-w-[1.45rem] text-center text-[0.78rem] font-bold text-[#201712]/[0.7]">
                                {quantityInCart}
                            </span>
                            <button
                                type="button"
                                className="flex min-h-[2.55rem] w-[2.55rem] items-center justify-center rounded-full border border-transparent p-0 text-[1.05rem] font-bold leading-none text-[#fffaf5] shadow-[inset_0_1px_rgba(255,255,255,0.16),0_14px_28px_rgba(35,22,16,0.2),0_0_0_1px_color-mix(in_srgb,var(--product-accent)_22%,rgba(17,10,8,0.92))] transition-[transform,box-shadow,background,opacity] duration-[220ms] ease-out enabled:hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-[0.42] disabled:transform-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d06b34]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#fbf7f2]"
                                aria-label={`Add one ${product.title}`}
                                disabled={product.price === null}
                                style={{
                                    backgroundImage:
                                        'linear-gradient(135deg, color-mix(in srgb, var(--product-deep) 72%, #120b08), color-mix(in srgb, var(--product-accent) 32%, #231712))',
                                    textShadow: '0 1px 0 rgba(0, 0, 0, 0.22)',
                                }}
                                onClick={() => {
                                    onAdjustCart(1);
                                }}>
                                +
                            </button>
                        </div>
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
