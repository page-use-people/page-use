import type {CSSProperties} from 'react';

export type TCartLine = {
    readonly productId: number;
    readonly title: string;
    readonly quantity: number;
    readonly price: number | null;
    readonly lineTotal: number | null;
    readonly accent: string;
    readonly shell: string;
    readonly imageUrl: string;
};

type TCartPanelProps = {
    readonly isOpen: boolean;
    readonly isPulsing: boolean;
    readonly cartLines: readonly TCartLine[];
    readonly totalItems: number;
    readonly subtotal: number | null;
    readonly fabRef?: (node: HTMLButtonElement | null) => void;
    readonly onAdjustCart: (productId: number, delta: number) => void;
    readonly onOpenProduct: (productId: number) => void;
    readonly onToggle: () => void;
    readonly onClose: () => void;
};

export const CartPanel = ({
    isOpen,
    isPulsing,
    cartLines,
    totalItems,
    subtotal,
    fabRef,
    onAdjustCart,
    onOpenProduct,
    onToggle,
    onClose,
}: TCartPanelProps) => (
    <>
        <button
            ref={fabRef}
            type="button"
            className="grocery-cart-fab"
            data-open={isOpen ? 'true' : 'false'}
            data-pulse={isPulsing ? 'true' : 'false'}
            onClick={onToggle}
            aria-expanded={isOpen}
            aria-controls="grocery-cart-drawer">
            <span className="grocery-cart-fab__icon">Bag</span>
            <span className="grocery-cart-fab__label">Cart</span>
            <span className="grocery-cart-fab__count">{totalItems}</span>
        </button>

        <aside
            id="grocery-cart-drawer"
            className="grocery-cart-panel"
            data-open={isOpen ? 'true' : 'false'}>
            <div className="grocery-cart-panel__header">
                <div>
                    <span className="grocery-kicker">Basket</span>
                    <h2>
                        {totalItems} item{totalItems === 1 ? '' : 's'}
                    </h2>
                </div>
                <button
                    type="button"
                    className="grocery-cart-panel__close"
                    onClick={onClose}>
                    Close
                </button>
            </div>

            <div className="grocery-cart-panel__summary">
                <span>Subtotal</span>
                <strong>
                    {subtotal === null
                        ? 'Contains price-on-request items'
                        : `BDT ${subtotal.toLocaleString('en-US')}`}
                </strong>
            </div>

            <div className="grocery-cart-panel__lines">
                {cartLines.length > 0 ? (
                    cartLines.map((line) => (
                        <div
                            key={line.productId}
                            className="grocery-cart-panel__line"
                            style={
                                {
                                    '--line-accent': line.accent,
                                    '--line-shell': line.shell,
                                } as CSSProperties
                            }>
                            <button
                                type="button"
                                className="grocery-cart-panel__line-preview"
                                onClick={() => onOpenProduct(line.productId)}>
                                <img
                                    src={line.imageUrl}
                                    alt={line.title}
                                    loading="lazy"
                                />
                            </button>

                            <div className="grocery-cart-panel__line-copy">
                                <button
                                    type="button"
                                    className="grocery-cart-panel__line-title"
                                    onClick={() => onOpenProduct(line.productId)}>
                                    {line.title}
                                </button>
                                <p>
                                    {line.lineTotal === null
                                        ? `${line.quantity} x price on request`
                                        : `BDT ${line.lineTotal.toLocaleString('en-US')}`}
                                </p>
                            </div>

                            <div className="grocery-cart-panel__line-controls">
                                <button
                                    type="button"
                                    onClick={() => onAdjustCart(line.productId, -1)}>
                                    -
                                </button>
                                <span>{line.quantity}</span>
                                <button
                                    type="button"
                                    onClick={() => onAdjustCart(line.productId, 1)}>
                                    +
                                </button>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="grocery-cart-panel__empty">
                        <p>Your cart is empty.</p>
                        <span>
                            Open any product modal to add something and the count
                            badge will update here.
                        </span>
                    </div>
                )}
            </div>
        </aside>
    </>
);
