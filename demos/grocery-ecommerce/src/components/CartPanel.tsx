import {memo, useEffect, useRef} from 'react';
import type {TCartLine} from '../lib/cart.ts';
import {buildThumbStyle} from '../lib/theme-style.ts';
import {useRegistryCallbacks} from '../contexts/element-registry-context.ts';

export type {TCartLine} from '../lib/cart.ts';

type TCartPanelProps = {
    readonly cartLines: readonly TCartLine[];
    readonly totalItems: number;
    readonly subtotal: number | null;
    readonly onAdjustCart: (productId: number, delta: number) => void;
};

export const CartPanel = memo(
    ({cartLines, totalItems, subtotal, onAdjustCart}: TCartPanelProps) => {
        const {registerCartPanel, registerCartLine} = useRegistryCallbacks();

        const previousQuantitiesRef = useRef<Record<number, number>>({});
        const lineRefsRef = useRef<Record<number, HTMLElement | null>>({});

        useEffect(() => {
            const previousQuantities = previousQuantitiesRef.current;
            const changedIds = cartLines
                .filter(
                    (line) =>
                        previousQuantities[line.productId] !== line.quantity,
                )
                .map((line) => line.productId);

            previousQuantitiesRef.current = Object.fromEntries(
                cartLines.map((line) => [line.productId, line.quantity]),
            );

            if (changedIds.length === 0) {
                return;
            }

            changedIds.forEach((id) => {
                lineRefsRef.current[id]?.animate(
                    [
                        {outlineColor: 'transparent', zIndex: 99999},
                        {
                            outlineColor: 'rgba(255,182,57,0.8)',
                            zIndex: 99999,
                        },
                        {outlineColor: 'transparent'},
                    ],
                    {
                        duration: 2_000,
                        fill: 'forwards',
                        easing: 'cubic-bezier(0, 1, 0.999, -0.003)',
                    },
                );
            });
        }, [cartLines]);

        return (
            <aside
                className="sticky top-20 flex flex-col self-start"
                ref={registerCartPanel}>
                <section className="border border-stone-200 rounded-lg p-3 grid w-full min-w-0 grid-rows-[auto_minmax(0,1fr)] gap-2.5 overflow-hidden rounded-5xl bg-white p-1 max-h-[calc(100vh-8rem)]">
                    <h2 className={'font-semibold text-xl px-4'}>Cart</h2>
                    <div className="flex h-full flex-col gap-2 overflow-y-auto overflow-x-hidden py-5 px-2">
                        {cartLines.length > 0 ? (
                            cartLines.map((line) => (
                                <div
                                    key={line.productId}
                                    ref={(node) => {
                                        lineRefsRef.current[line.productId] =
                                            node;
                                        registerCartLine(line.productId, node);
                                    }}
                                    className="relative flex flex-row gap-2 rounded-3xl bg-white p-2 text-left transition-[transform,background] duration-200 ease-out outline outline-[2px] outline-transparent">
                                    <div
                                        className="grid h-20 w-20 place-items-center self-stretch overflow-hidden rounded-2xl shadow-[inset_0_0_0_1px_rgba(0,0,0,0.1)]"
                                        style={buildThumbStyle(line.theme)}
                                        aria-hidden="true">
                                        <img
                                            src={line.imageUrl}
                                            alt={line.title}
                                            loading="lazy"
                                            className="h-12 w-12 object-contain"
                                        />
                                    </div>

                                    <div className="grid min-w-0 content-start gap-0.5">
                                        <div className="flex min-w-0 items-start justify-between gap-1.5">
                                            <p className="m-0 w-full min-w-0 line-clamp-2 text-sm font-bold leading-tight text-[var(--g-ink)]">
                                                {line.title}
                                            </p>
                                        </div>

                                        <div className="mt-1 grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2">
                                            <div className="flex items-center gap-1 rounded-full bg-white p-1">
                                                <button
                                                    type="button"
                                                    className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--g-accent-strong)] text-sm text-[var(--g-on-accent)] transition-[transform,background,opacity] duration-200 ease-out hover:bg-[var(--g-accent)] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-accent)]/40 focus-visible:ring-offset-2"
                                                    aria-label={`Remove one ${line.title}`}
                                                    onClick={() =>
                                                        onAdjustCart(
                                                            line.productId,
                                                            -1,
                                                        )
                                                    }>
                                                    -
                                                </button>
                                                <span className="min-w-5 text-center text-xl font-bold">
                                                    {line.quantity}
                                                </span>
                                                <button
                                                    type="button"
                                                    className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--g-accent-strong)] text-sm text-[var(--g-on-accent)] transition-[transform,background,opacity] duration-200 ease-out hover:bg-[var(--g-accent)] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-accent)]/40 focus-visible:ring-offset-2"
                                                    aria-label={`Add one more ${line.title}`}
                                                    disabled={
                                                        line.price === null
                                                    }
                                                    onClick={() =>
                                                        onAdjustCart(
                                                            line.productId,
                                                            1,
                                                        )
                                                    }>
                                                    +
                                                </button>
                                            </div>

                                            <div className="grid min-w-0 justify-items-end gap-px">
                                                <span className="whitespace-nowrap text-xs font-bold tracking-wide text-[var(--g-ink-muted)]">
                                                    {line.price === null
                                                        ? 'Price on request'
                                                        : `${line.price.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} each`}
                                                </span>
                                                <strong className="whitespace-nowrap text-base leading-none text-right">
                                                    {line.lineTotal === null
                                                        ? `${line.quantity} selected`
                                                        : line.lineTotal.toLocaleString(
                                                              'en-US',
                                                              {
                                                                  minimumFractionDigits: 2,
                                                                  maximumFractionDigits: 2,
                                                              },
                                                          )}
                                                </strong>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="flex flex-none items-start gap-1 rounded-2xl bg-white px-4 py-4">
                                <p className="m-0 text-sm font-medium text-[var(--g-ink-muted)]">
                                    Basket is empty.
                                </p>
                            </div>
                        )}
                    </div>
                </section>
            </aside>
        );
    },
    (previousProps, nextProps) =>
        previousProps.cartLines === nextProps.cartLines &&
        previousProps.totalItems === nextProps.totalItems &&
        previousProps.subtotal === nextProps.subtotal,
);

CartPanel.displayName = 'CartPanel';
