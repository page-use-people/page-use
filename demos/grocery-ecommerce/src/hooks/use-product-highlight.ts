import {useEffect, useRef, useState} from 'react';

export const useProductHighlight = () => {
    const [highlightedProductIds, setHighlightedProductIds] = useState<
        ReadonlySet<number>
    >(() => new Set());
    const highlightTimersRef = useRef<Map<number, number>>(new Map());

    useEffect(
        () => () => {
            highlightTimersRef.current.forEach((timer) => {
                window.clearTimeout(timer);
            });
        },
        [],
    );

    const flashProducts = (
        productIds: readonly number[],
        duration = 3500,
    ) => {
        if (productIds.length === 0) {
            return;
        }

        setHighlightedProductIds((current) => {
            const next = new Set(current);
            productIds.forEach((id) => next.add(id));
            return next;
        });

        productIds.forEach((productId) => {
            const existingTimer = highlightTimersRef.current.get(productId);
            if (existingTimer !== undefined) {
                window.clearTimeout(existingTimer);
            }

            const timer = window.setTimeout(() => {
                setHighlightedProductIds((current) =>
                    current.has(productId)
                        ? (() => {
                              const next = new Set(current);
                              next.delete(productId);
                              return next;
                          })()
                        : current,
                );
                highlightTimersRef.current.delete(productId);
            }, duration);

            highlightTimersRef.current.set(productId, timer);
        });
    };

    return {highlightedProductIds, flashProducts} as const;
};
