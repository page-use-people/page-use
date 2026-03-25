import {type TCatalogProduct} from './catalog.ts';

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

export type TCartSummary = {
    readonly totalItems: number;
    readonly subtotal: number | null;
    readonly lines: readonly TCartLine[];
};

export type TCartQuantities = Readonly<Record<number, number>>;

export type TCartActivity = Readonly<Record<number, number>>;

export type TCartState = {
    readonly quantities: TCartQuantities;
    readonly activity: TCartActivity;
    readonly activityCounter: number;
};

export type TCartMutationResult = {
    readonly state: TCartState;
    readonly summary: TCartSummary;
};

const buildCartLine = (
    product: TCatalogProduct,
    quantity: number,
): TCartLine | null => {
    if (quantity <= 0) {
        return null;
    }

    return {
        productId: product.id,
        title: product.title,
        quantity,
        price: product.price,
        lineTotal: product.price === null ? null : product.price * quantity,
        accent: product.theme.accent,
        shell: product.theme.shell,
        imageUrl: product.imageUrl,
    };
};

export const buildCartLines = (
    productMap: ReadonlyMap<number, TCatalogProduct>,
    cartQuantities: TCartQuantities,
    cartActivity: TCartActivity,
): readonly TCartLine[] =>
    Object.entries(cartQuantities)
        .map(([productIdKey, quantity]) => {
            const productId = Number(productIdKey);
            const product = productMap.get(productId);
            if (!product || quantity <= 0) {
                return null;
            }

            return buildCartLine(product, quantity);
        })
        .filter((line): line is TCartLine => line !== null)
        .sort((left, right) => {
            const rightActivity = cartActivity[right.productId] ?? 0;
            const leftActivity = cartActivity[left.productId] ?? 0;

            if (rightActivity !== leftActivity) {
                return rightActivity - leftActivity;
            }

            return 0;
        });

export const summarizeCartLines = (
    cartLines: readonly TCartLine[],
): TCartSummary => {
    const totalItems = cartLines.reduce((sum, line) => sum + line.quantity, 0);
    const subtotal = cartLines.some((line) => line.lineTotal === null)
        ? null
        : cartLines.reduce((sum, line) => sum + (line.lineTotal ?? 0), 0);

    return {
        totalItems,
        subtotal,
        lines: cartLines,
    };
};

export const buildCartSummary = (
    productMap: ReadonlyMap<number, TCatalogProduct>,
    cartQuantities: TCartQuantities,
    cartActivity: TCartActivity,
): TCartSummary =>
    summarizeCartLines(
        buildCartLines(productMap, cartQuantities, cartActivity),
    );

export const mutateCartState = (
    productMap: ReadonlyMap<number, TCatalogProduct>,
    cartState: TCartState,
    productId: number,
    quantityDelta: number,
): TCartMutationResult => {
    const product = productMap.get(productId);
    if (!product) {
        throw new Error(`Unknown product id: ${productId}`);
    }

    if (quantityDelta > 0 && product.price === null) {
        return {
            state: cartState,
            summary: buildCartSummary(
                productMap,
                cartState.quantities,
                cartState.activity,
            ),
        };
    }

    const nextQuantities = {...cartState.quantities};
    const nextActivity = {...cartState.activity};
    const currentQuantity = nextQuantities[productId] ?? 0;
    const nextQuantity = Math.max(0, currentQuantity + quantityDelta);

    if (nextQuantity === 0) {
        delete nextQuantities[productId];
        delete nextActivity[productId];
    } else {
        nextQuantities[productId] = nextQuantity;
        if (nextActivity[productId] === undefined) {
            const nextActivityCounter = cartState.activityCounter + 1;
            nextActivity[productId] = nextActivityCounter;

            const nextState: TCartState = {
                quantities: nextQuantities,
                activity: nextActivity,
                activityCounter: nextActivityCounter,
            };

            return {
                state: nextState,
                summary: buildCartSummary(productMap, nextQuantities, nextActivity),
            };
        }
    }

    const nextState: TCartState = {
        quantities: nextQuantities,
        activity: nextActivity,
        activityCounter: cartState.activityCounter,
    };

    return {
        state: nextState,
        summary: buildCartSummary(productMap, nextQuantities, nextActivity),
    };
};
