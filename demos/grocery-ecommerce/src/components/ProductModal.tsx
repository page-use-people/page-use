import {memo, type CSSProperties} from 'react';
import {formatPrice, type TCatalogProduct} from '../lib/catalog.ts';

type TProductModalProps = {
    readonly product: TCatalogProduct | null;
    readonly isAgentActive: boolean;
    readonly addButtonRef: (node: HTMLButtonElement | null) => void;
    readonly onBackdropClick: () => void;
    readonly onClose: () => void;
    readonly onAddToCart: () => void;
};

export const ProductModal = memo(
    ({
        product,
        isAgentActive,
        addButtonRef,
        onBackdropClick,
        onClose,
        onAddToCart,
    }: TProductModalProps) => {
        if (!product) {
            return null;
        }

        const modalStyle = {
            '--modal-accent': product.theme.accent,
            '--modal-support': product.theme.support,
            '--modal-deep': product.theme.deep,
            '--modal-soft': product.theme.soft,
            '--modal-shell': product.theme.shell,
            '--modal-glow': product.theme.glow,
            '--modal-foreground-accent': product.theme.foregroundOnAccent,
            '--modal-foreground-soft': product.theme.foregroundOnSoft,
        } as CSSProperties;

        return (
            <div
                className="grocery-modal-backdrop"
                style={modalStyle}
                onClick={onBackdropClick}>
                <div
                    className="grocery-modal"
                    data-agent-active={isAgentActive ? 'true' : 'false'}
                    onClick={(event) => event.stopPropagation()}>
                    <button
                        type="button"
                        className="grocery-modal__close"
                        aria-label="Close product"
                        onClick={onClose}>
                        ×
                    </button>

                    <div className="grocery-modal__media">
                        <img
                            src={product.imageUrl}
                            alt={product.title}
                            loading="lazy"
                        />
                    </div>

                    <div className="grocery-modal__content">
                        <span className="grocery-kicker">
                            {product.primaryCategoryLabel ?? 'Product detail'}
                        </span>
                        <h2>{product.title}</h2>
                        <p className="grocery-modal__subtitle">{product.subtitle}</p>
                        <strong className="grocery-modal__price">
                            {formatPrice(product.price)}
                        </strong>

                        <div className="grocery-modal__swatches">
                            <i style={{backgroundColor: product.theme.accent}} />
                            <i style={{backgroundColor: product.theme.support}} />
                            <i style={{backgroundColor: product.theme.deep}} />
                            <i style={{backgroundColor: product.theme.soft}} />
                        </div>

                        <div className="grocery-modal__actions">
                            <button
                                type="button"
                                className="grocery-modal__primary"
                                ref={addButtonRef}
                                disabled={product.price === null}
                                data-agent-active={isAgentActive ? 'true' : 'false'}
                                onClick={onAddToCart}>
                                {product.price === null ? 'Ask for price' : 'Add to cart'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    },
    (previousProps, nextProps) =>
        previousProps.product === nextProps.product &&
        previousProps.isAgentActive === nextProps.isAgentActive,
);

ProductModal.displayName = 'ProductModal';
