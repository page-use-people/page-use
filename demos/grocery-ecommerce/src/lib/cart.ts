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

export type TCartMutation = {
    readonly productId: number;
    readonly quantityDelta: number;
};

export type TCartBatchMutationResult = {
    readonly state: TCartState;
    readonly summary: TCartSummary;
    readonly touchedProductIds: readonly number[];
    readonly addedProductIds: readonly number[];
    readonly removedProductIds: readonly number[];
};

const buildCartLine = (
    product: TCatalogProduct,
    quantity: number,
): TCartLine | null =>
    quantity <= 0
        ? null
        : Object.freeze({
              productId: product.id,
              title: product.title,
              quantity,
              price: product.price,
              lineTotal:
                  product.price === null ? null : product.price * quantity,
              accent: product.theme.accent,
              shell: product.theme.shell,
              imageUrl: product.imageUrl,
          });

export const buildCartLines = (
    productMap: ReadonlyMap<number, TCatalogProduct>,
    cartQuantities: TCartQuantities,
    cartActivity: TCartActivity,
): readonly TCartLine[] =>
    Object.entries(cartQuantities)
        .map(([productIdKey, quantity]) => {
            const product = productMap.get(Number(productIdKey));
            return product && quantity > 0
                ? buildCartLine(product, quantity)
                : null;
        })
        .filter((line): line is TCartLine => line !== null)
        .sort((left, right) => {
            const rightActivity = cartActivity[right.productId] ?? 0;
            const leftActivity = cartActivity[left.productId] ?? 0;
            return rightActivity - leftActivity;
        });

export const summarizeCartLines = (
    cartLines: readonly TCartLine[],
): TCartSummary => {
    const totalItems = cartLines.reduce((sum, line) => sum + line.quantity, 0);
    const subtotal = cartLines.some((line) => line.lineTotal === null)
        ? null
        : cartLines.reduce((sum, line) => sum + (line.lineTotal ?? 0), 0);

    return Object.freeze({totalItems, subtotal, lines: cartLines});
};

export const buildCartSummary = (
    productMap: ReadonlyMap<number, TCatalogProduct>,
    cartQuantities: TCartQuantities,
    cartActivity: TCartActivity,
): TCartSummary =>
    summarizeCartLines(
        buildCartLines(productMap, cartQuantities, cartActivity),
    );

const removeKey = (
    record: Readonly<Record<number, number>>,
    key: number,
): Readonly<Record<number, number>> =>
    Object.freeze(
        Object.fromEntries(
            Object.entries(record).filter(
                ([entryKey]) => Number(entryKey) !== key,
            ),
        ),
    );

const setKey = (
    record: Readonly<Record<number, number>>,
    key: number,
    value: number,
): Readonly<Record<number, number>> =>
    Object.freeze({...record, [key]: value});

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

    const currentQuantity = cartState.quantities[productId] ?? 0;
    const nextQuantity = Math.max(0, currentQuantity + quantityDelta);

    const nextQuantities =
        nextQuantity === 0
            ? removeKey(cartState.quantities, productId)
            : setKey(cartState.quantities, productId, nextQuantity);

    const needsNewActivity =
        nextQuantity > 0 && cartState.activity[productId] === undefined;
    const nextActivityCounter = needsNewActivity
        ? cartState.activityCounter + 1
        : cartState.activityCounter;

    const nextActivity =
        nextQuantity === 0
            ? removeKey(cartState.activity, productId)
            : needsNewActivity
              ? setKey(cartState.activity, productId, nextActivityCounter)
              : cartState.activity;

    const nextState: TCartState = Object.freeze({
        quantities: nextQuantities,
        activity: nextActivity,
        activityCounter: nextActivityCounter,
    });

    return {
        state: nextState,
        summary: buildCartSummary(productMap, nextQuantities, nextActivity),
    };
};

type TBatchAccumulator = {
    readonly state: TCartState;
    readonly touched: readonly number[];
    readonly added: readonly number[];
    readonly removed: readonly number[];
};

const applyOneMutation = (
    productMap: ReadonlyMap<number, TCatalogProduct>,
    acc: TBatchAccumulator,
    mutation: TCartMutation,
): TBatchAccumulator => {
    const product = productMap.get(mutation.productId);
    if (!product) {
        throw new Error(`Unknown product id: ${mutation.productId}`);
    }

    if (
        mutation.quantityDelta === 0 ||
        (mutation.quantityDelta > 0 && product.price === null)
    ) {
        return acc;
    }

    const currentQuantity = acc.state.quantities[product.id] ?? 0;
    const nextQuantity = Math.max(
        0,
        currentQuantity + mutation.quantityDelta,
    );

    if (nextQuantity === currentQuantity) {
        return acc;
    }

    const nextQuantities =
        nextQuantity === 0
            ? removeKey(acc.state.quantities, product.id)
            : setKey(acc.state.quantities, product.id, nextQuantity);

    const needsNewActivity =
        nextQuantity > 0 && acc.state.activity[product.id] === undefined;
    const nextActivityCounter = needsNewActivity
        ? acc.state.activityCounter + 1
        : acc.state.activityCounter;

    const nextActivity =
        nextQuantity === 0
            ? removeKey(acc.state.activity, product.id)
            : needsNewActivity
              ? setKey(acc.state.activity, product.id, nextActivityCounter)
              : acc.state.activity;

    return {
        state: Object.freeze({
            quantities: nextQuantities,
            activity: nextActivity,
            activityCounter: nextActivityCounter,
        }),
        touched: [...acc.touched, product.id],
        added:
            nextQuantity > currentQuantity
                ? [...acc.added, product.id]
                : acc.added,
        removed:
            nextQuantity < currentQuantity
                ? [...acc.removed, product.id]
                : acc.removed,
    };
};

export const mutateCartStateBatch = (
    productMap: ReadonlyMap<number, TCatalogProduct>,
    cartState: TCartState,
    mutations: readonly TCartMutation[],
): TCartBatchMutationResult => {
    const initial: TBatchAccumulator = Object.freeze({
        state: cartState,
        touched: [],
        added: [],
        removed: [],
    });

    const result = mutations.reduce(
        (acc, mutation) => applyOneMutation(productMap, acc, mutation),
        initial,
    );

    return {
        state: result.state,
        summary: buildCartSummary(
            productMap,
            result.state.quantities,
            result.state.activity,
        ),
        touchedProductIds: result.touched,
        addedProductIds: result.added,
        removedProductIds: result.removed,
    };
};
