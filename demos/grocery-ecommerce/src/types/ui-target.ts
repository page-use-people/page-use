type TUITargetSearchPanel = {readonly kind: 'search-panel'};
type TUITargetCategory = {
    readonly kind: 'category';
    readonly categoryKey: string | null;
};
type TUITargetProduct = {
    readonly kind: 'product';
    readonly productId: number;
};
type TUITargetCartLine = {
    readonly kind: 'cart-line';
    readonly productId: number;
};
type TUITargetWindowNav = {
    readonly kind: 'window-nav';
    readonly direction: 'next' | 'previous';
};

export type TUITarget =
    | TUITargetSearchPanel
    | TUITargetCategory
    | TUITargetProduct
    | TUITargetCartLine
    | TUITargetWindowNav;

export const searchPanelTarget = (): TUITarget =>
    Object.freeze({kind: 'search-panel' as const});

export const categoryTarget = (categoryKey: string | null): TUITarget =>
    Object.freeze({kind: 'category' as const, categoryKey});

export const productTarget = (productId: number): TUITarget =>
    Object.freeze({kind: 'product' as const, productId});

export const cartLineTarget = (productId: number): TUITarget =>
    Object.freeze({kind: 'cart-line' as const, productId});

export const windowNavTarget = (
    direction: 'next' | 'previous',
): TUITarget => Object.freeze({kind: 'window-nav' as const, direction});

export const serializeUITarget = (target: TUITarget): string => {
    switch (target.kind) {
        case 'search-panel':
            return 'search-panel';
        case 'category':
            return target.categoryKey === null
                ? 'category:all'
                : `category:${target.categoryKey}`;
        case 'product':
            return `product:${target.productId}`;
        case 'cart-line':
            return `cart:line:${target.productId}`;
        case 'window-nav':
            return `window:${target.direction}`;
    }
};

export const isBrowserTarget = (target: TUITarget | null): boolean =>
    target !== null && target.kind !== 'cart-line';

export const isCartTarget = (target: TUITarget | null): boolean =>
    target !== null && target.kind === 'cart-line';

export const getCartLineProductId = (target: TUITarget | null): number | null =>
    target?.kind === 'cart-line' ? target.productId : null;
