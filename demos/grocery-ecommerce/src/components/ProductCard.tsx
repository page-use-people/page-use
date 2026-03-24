import {formatPrice, type TCatalogProduct} from '../lib/catalog.ts';

type TProductCardProps = {
    readonly product: TCatalogProduct;
    readonly quantityInCart: number;
    readonly isHighlighted: boolean;
    readonly onOpen: () => void;
    readonly registerRef: (node: HTMLElement | null) => void;
};

export const ProductCard = ({
    product,
    quantityInCart,
    isHighlighted,
    onOpen,
    registerRef,
}: TProductCardProps) => (
    <article
        ref={registerRef}
        className="grocery-product-card"
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
            <div className="grocery-product-card__eyebrow">
                <span>{product.primaryCategoryLabel ?? 'General grocery'}</span>
                {quantityInCart > 0 ? (
                    <span className="grocery-product-card__count">
                        {quantityInCart} in cart
                    </span>
                ) : null}
            </div>

            <h3 className="grocery-product-card__title">{product.title}</h3>
            <p className="grocery-product-card__subtitle">{product.subtitle}</p>

            <div className="grocery-product-card__footer">
                <strong className="grocery-product-card__price">
                    {formatPrice(product.price)}
                </strong>
            </div>
        </div>

        <div className="grocery-product-card__actions">
            <button
                type="button"
                className="grocery-product-card__secondary"
                onClick={onOpen}>
                View product
            </button>
        </div>
    </article>
);
