import type {TCartMutation} from './cart.ts';

export const normalizeCartMutations = (
    mutations: readonly TCartMutation[],
): readonly TCartMutation[] =>
    [
        ...mutations
            .reduce(
                (map, mutation) =>
                    map.set(
                        mutation.productId,
                        (map.get(mutation.productId) ?? 0) +
                            mutation.quantityDelta,
                    ),
                new Map<number, number>(),
            )
            .entries(),
    ]
        .map(([productId, quantityDelta]) => ({productId, quantityDelta}))
        .filter((mutation) => mutation.quantityDelta !== 0);
