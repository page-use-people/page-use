import {useMemo, useRef} from 'react';
import {
    buildCartLines,
    mutateCartStateBatch,
    summarizeCartLines,
    type TCartMutation,
    type TCartSummary,
} from '../lib/cart.ts';
import {normalizeCartMutations} from '../lib/cart-normalization.ts';
import type {TCatalogData} from '../lib/catalog.ts';
import {useLatestState} from './use-latest-state.ts';

export const useCartState = (catalog: TCatalogData | null) => {
    const [cartQuantities, setCartQuantities, cartQuantitiesRef] =
        useLatestState<Record<number, number>>({});
    const [cartActivity, setCartActivity, cartActivityRef] =
        useLatestState<Record<number, number>>({});
    const cartActivityCounterRef = useRef(0);

    const cartLines = useMemo(
        () =>
            catalog
                ? buildCartLines(
                      catalog.productMap,
                      cartQuantities,
                      cartActivity,
                  )
                : [],
        [catalog, cartActivity, cartQuantities],
    );

    const cartSummary = useMemo<TCartSummary>(
        () => summarizeCartLines(cartLines),
        [cartLines],
    );

    const applyCartMutations = (mutations: readonly TCartMutation[]) => {
        if (!catalog) {
            return {
                summary: cartSummary,
                touchedProductIds: [] as readonly number[],
                addedProductIds: [] as readonly number[],
                removedProductIds: [] as readonly number[],
            };
        }

        const normalizedMutations = normalizeCartMutations(mutations);
        if (normalizedMutations.length === 0) {
            return {
                summary: cartSummary,
                touchedProductIds: [] as readonly number[],
                addedProductIds: [] as readonly number[],
                removedProductIds: [] as readonly number[],
            };
        }

        const mutationResult = mutateCartStateBatch(
            catalog.productMap,
            {
                quantities: cartQuantitiesRef.current,
                activity: cartActivityRef.current,
                activityCounter: cartActivityCounterRef.current,
            },
            normalizedMutations,
        );

        setCartQuantities(mutationResult.state.quantities);
        setCartActivity(mutationResult.state.activity);
        cartActivityCounterRef.current = mutationResult.state.activityCounter;

        return {
            summary: mutationResult.summary,
            touchedProductIds: mutationResult.touchedProductIds,
            addedProductIds: mutationResult.addedProductIds,
            removedProductIds: mutationResult.removedProductIds,
        };
    };

    return {
        cartQuantities,
        cartActivity,
        cartLines,
        cartSummary,

        cartQuantitiesRef,
        cartActivityRef,

        applyCartMutations,
    } as const;
};

export type TCartState = ReturnType<typeof useCartState>;
