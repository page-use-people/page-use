import {formatPrice, type TCatalogProduct} from '../lib/catalog.ts';

type TProductCardProps = {
    readonly product: TCatalogProduct;
    readonly quantityInCart: number;
    readonly isHighlighted: boolean;
    readonly isAgentActive: boolean;
    readonly onOpen: () => void;
    readonly registerRef: (node: HTMLElement | null) => void;
};

export const ProductCard = ({
    product,
    quantityInCart,
    isHighlighted,
    isAgentActive,
    onOpen,
    registerRef,
}: TProductCardProps) => (
    <article
        ref={registerRef}
        className="grocery-product-card"
        data-agent-active={isAgentActive ? 'true' : 'false'}
        data-highlighted={isHighlighted ? 'true' : 'false'}>
        <div className="grocery-product-card__media">
            <img
                src={product.imageUrl}
                alt={product.title}
                loading="lazy"
                className="grocery-product-card__image"
            />
        </div>

        <div className="grocery-product-card__content">
            {quantityInCart > 0 ? (
                <div className="grocery-product-card__eyebrow">
                    <span className="grocery-product-card__count">
                        {quantityInCart}x in cart
                    </span>
                </div>
            ) : null}

            <h3 className="grocery-product-card__title">{product.title}</h3>
            <p className="grocery-product-card__subtitle">{product.subtitle}</p>

            <div className="grocery-product-card__footer">
                <strong className="grocery-product-card__price">
                    {formatPrice(product.price)}
                </strong>
                <button
                    type="button"
                    className="grocery-product-card__secondary"
                    onClick={onOpen}>
                    View
                </button>
            </div>
        </div>
    </article>
);
