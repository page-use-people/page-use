import {memo, useEffect, useRef, useState, type CSSProperties} from 'react';
import type {TCartLine} from '../lib/cart.ts';
import {useRegistryCallbacks} from '../contexts/element-registry-context.ts';
import {useAgentTarget} from '../contexts/agent-target-context.ts';

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
        const activeUiTarget = useAgentTarget();

        const activeProductId = activeUiTarget?.startsWith('cart:line:')
            ? Number(activeUiTarget.slice('cart:line:'.length))
            : null;
        const isAgentActive = activeUiTarget?.startsWith('cart:') ?? false;

        const previousQuantitiesRef = useRef<Record<number, number>>({});
        const [recentlyChangedIds, setRecentlyChangedIds] = useState<
            ReadonlySet<number>
        >(() => new Set());

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

            setRecentlyChangedIds((current) => {
                const next = new Set(current);
                changedIds.forEach((id) => next.add(id));
                return next;
            });

            const timer = window.setTimeout(() => {
                setRecentlyChangedIds((current) => {
                    const next = new Set(current);
                    changedIds.forEach((id) => next.delete(id));
                    return next;
                });
            }, 820);

            return () => {
                window.clearTimeout(timer);
            };
        }, [cartLines]);

        return (
            <aside
                className="sticky top-20 flex flex-col self-start"
                ref={registerCartPanel}
                data-agent-active={isAgentActive ? 'true' : 'false'}>
                <section
                    className="grid w-full min-w-0 grid-rows-[auto_minmax(0,1fr)] gap-2.5 overflow-hidden rounded-3xl bg-white p-4"
                    data-agent-active={isAgentActive ? 'true' : 'false'}>
                    <div className="flex items-center gap-2.5 px-0.5">
                        <span className="inline-flex min-h-8 items-center rounded-full bg-white px-2.5 py-1 text-xs font-bold uppercase tracking-widest text-[var(--g-ink-muted)]">
                            {totalItems} item{totalItems === 1 ? '' : 's'}
                        </span>
                        <span className="inline-flex min-h-8 items-center rounded-full bg-white px-2.5 py-1 text-xs font-bold uppercase tracking-widest text-[var(--g-ink-muted)]">
                            {subtotal === null
                                ? 'Mixed pricing'
                                : subtotal.toLocaleString('en-US')}
                        </span>
                    </div>

                    <div className="flex min-h-0 min-w-0 flex-col gap-3 overflow-y-auto overflow-x-hidden px-1.5 pb-3.5 pt-1.5 overscroll-contain [scrollbar-gutter:stable_both-edges] max-h-[calc(100vh-12rem)]">
                        {cartLines.length > 0 ? (
                            cartLines.map((line) => (
                                <div
                                    key={line.productId}
                                    ref={(node) => {
                                        registerCartLine(line.productId, node);
                                    }}
                                    className="relative flex-none grid grid-cols-[4.2rem_minmax(0,1fr)] gap-2.5 overflow-hidden rounded-2xl bg-white px-3 py-3 text-left transition-[transform,background] duration-200 ease-out data-[flash=true]:animate-[grocery-cart-line-flash_760ms_cubic-bezier(0.2,0.9,0.2,1)]"
                                    data-agent-active={
                                        activeProductId === line.productId
                                            ? 'true'
                                            : 'false'
                                    }
                                    data-flash={
                                        recentlyChangedIds.has(line.productId)
                                            ? 'true'
                                            : 'false'
                                    }
                                    style={
                                        {
                                            '--line-accent': line.accent,
                                            '--line-shell': line.shell,
                                            backgroundImage:
                                                'radial-gradient(circle at top left, color-mix(in srgb, var(--line-accent) 24%, rgba(255, 255, 255, 0.97)) 0, color-mix(in srgb, var(--line-accent) 12%, rgba(255, 255, 255, 0.97)) 26%, transparent 62%), linear-gradient(180deg, color-mix(in srgb, var(--line-shell) 56%, white), rgba(255, 255, 255, 0.99)), rgba(255, 255, 255, 0.95)',
                                        } as CSSProperties
                                    }>
                                    <div
                                        className="grid h-16 w-16 place-items-center self-stretch overflow-hidden rounded-2xl bg-white"
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
                                            <p
                                                className="m-0 w-full min-w-0 overflow-hidden text-ellipsis text-sm font-bold leading-tight text-[var(--g-ink)]"
                                                style={
                                                    {
                                                        display: '-webkit-box',
                                                        WebkitBoxOrient:
                                                            'vertical',
                                                        WebkitLineClamp: 2,
                                                    } as CSSProperties
                                                }>
                                                {line.title}
                                            </p>
                                        </div>

                                        <div className="mt-1 grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2">
                                            <div className="flex items-center gap-1 rounded-full bg-white p-1">
                                                <button
                                                    type="button"
                                                    className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--g-accent-strong)] text-sm text-[#f7fcf8] transition-[transform,background,opacity] duration-200 ease-out hover:-translate-y-0.5 hover:bg-[var(--g-accent)] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-accent)]/40 focus-visible:ring-offset-2"
                                                    aria-label={`Remove one ${line.title}`}
                                                    onClick={() =>
                                                        onAdjustCart(
                                                            line.productId,
                                                            -1,
                                                        )
                                                    }>
                                                    -
                                                </button>
                                                <span className="min-w-5 text-center text-xs font-bold">
                                                    {line.quantity}
                                                </span>
                                                <button
                                                    type="button"
                                                    className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--g-accent-strong)] text-sm text-[#f7fcf8] transition-[transform,background,opacity] duration-200 ease-out hover:-translate-y-0.5 hover:bg-[var(--g-accent)] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-accent)]/40 focus-visible:ring-offset-2"
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
                                                <span className="whitespace-nowrap text-xs font-bold tracking-wide text-[rgba(95,119,107,0.86)]">
                                                    {line.price === null
                                                        ? 'Price on request'
                                                        : `${line.price.toLocaleString('en-US')} each`}
                                                </span>
                                                <strong className="whitespace-nowrap text-base leading-none text-right">
                                                    {line.lineTotal === null
                                                        ? `${line.quantity} selected`
                                                        : line.lineTotal.toLocaleString('en-US')}
                                                </strong>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="flex flex-none items-start gap-1 rounded-2xl bg-white px-4 py-4">
                                <p className="m-0 text-sm font-medium text-[rgba(95,119,107,0.9)]">
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
