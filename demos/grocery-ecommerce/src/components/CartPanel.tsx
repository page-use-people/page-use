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
    readonly activeProductId: number | null;
    readonly isAgentActive: boolean;
    readonly registerPanelRef: (node: HTMLElement | null) => void;
    readonly registerLineRef: (
        productId: number,
        node: HTMLElement | null,
    ) => void;
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
    activeProductId,
    isAgentActive,
    registerPanelRef,
    registerLineRef,
    onAdjustCart,
    onOpenProduct,
    onToggle,
    onClose,
}: TCartPanelProps) => (
    <aside
        className="grocery-cart-rail"
        data-open={isOpen ? 'true' : 'false'}>
        <button
            type="button"
            className="grocery-cart-fab"
            data-open={isOpen ? 'true' : 'false'}
            data-pulse={isPulsing ? 'true' : 'false'}
            onClick={onToggle}
            aria-label={`Cart, ${totalItems} item${totalItems === 1 ? '' : 's'}`}
            aria-expanded={isOpen}
            aria-controls="grocery-cart-drawer">
            <span className="grocery-cart-fab__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M6 8.5h12l-1 10H7l-1-10Z" />
                    <path d="M9.25 9V7.75a2.75 2.75 0 0 1 5.5 0V9" />
                </svg>
            </span>
            <span className="grocery-cart-fab__count">{totalItems}</span>
        </button>

        <section
            id="grocery-cart-drawer"
            className="grocery-cart-panel"
            data-open={isOpen ? 'true' : 'false'}
            data-agent-active={isAgentActive ? 'true' : 'false'}
            ref={registerPanelRef}>
            <div className="grocery-cart-panel__topbar">
                <div className="grocery-cart-panel__meta">
                    <span className="grocery-cart-panel__meta-chip">
                        {totalItems} item{totalItems === 1 ? '' : 's'}
                    </span>
                    <span className="grocery-cart-panel__meta-chip">
                        {subtotal === null
                            ? 'Mixed pricing'
                            : `৳${subtotal.toLocaleString('en-US')}`}
                    </span>
                </div>
                <button
                    type="button"
                    className="grocery-cart-panel__close"
                    aria-label="Minimize basket"
                    onClick={onClose}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M6 12h12" />
                        <path d="m15 8 4 4-4 4" />
                    </svg>
                </button>
            </div>

            <div className="grocery-cart-panel__lines">
                {cartLines.length > 0 ? (
                    cartLines.map((line) => (
                        <div
                            key={line.productId}
                            ref={(node) => {
                                registerLineRef(line.productId, node);
                            }}
                            className="grocery-cart-panel__line"
                            data-agent-active={
                                activeProductId === line.productId ? 'true' : 'false'
                            }
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
                                <div className="grocery-cart-panel__line-top">
                                    <button
                                        type="button"
                                        className="grocery-cart-panel__line-title"
                                        onClick={() => onOpenProduct(line.productId)}>
                                        {line.title}
                                    </button>
                                </div>

                                <div className="grocery-cart-panel__line-footer">
                                    <div className="grocery-cart-panel__line-controls">
                                        <button
                                            type="button"
                                            aria-label={`Remove one ${line.title}`}
                                            onClick={() => onAdjustCart(line.productId, -1)}>
                                            -
                                        </button>
                                        <span>{line.quantity}</span>
                                        <button
                                            type="button"
                                            aria-label={`Add one more ${line.title}`}
                                            disabled={line.price === null}
                                            onClick={() =>
                                                onAdjustCart(line.productId, 1)
                                            }>
                                            +
                                        </button>
                                    </div>

                                    <div className="grocery-cart-panel__line-pricing">
                                        <span className="grocery-cart-panel__line-each">
                                            {line.price === null
                                                ? 'Price on request'
                                                : `৳${line.price.toLocaleString('en-US')} each`}
                                        </span>
                                        <strong className="grocery-cart-panel__line-total">
                                            {line.lineTotal === null
                                                ? `${line.quantity} selected`
                                                : `৳${line.lineTotal.toLocaleString('en-US')}`}
                                        </strong>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="grocery-cart-panel__empty">
                        <p>Basket is empty.</p>
                    </div>
                )}
            </div>
        </section>
    </aside>
);
