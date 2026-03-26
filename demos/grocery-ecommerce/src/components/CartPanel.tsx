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
                className="sticky top-[5rem] flex flex-col self-start"
                ref={registerCartPanel}
                data-agent-active={isAgentActive ? 'true' : 'false'}>
                <section
                    className="grid w-full min-w-0 grid-rows-[auto_minmax(0,1fr)] gap-[0.65rem] overflow-hidden rounded-[1.55rem] bg-white p-4"
                    data-agent-active={isAgentActive ? 'true' : 'false'}>
                    <div className="flex items-center gap-[0.65rem] px-[0.12rem]">
                        <span className="inline-flex min-h-[1.9rem] items-center rounded-full bg-white px-[0.65rem] py-[0.2rem] text-[0.68rem] font-bold uppercase tracking-[0.08em] text-[var(--g-ink-muted)]">
                            {totalItems} item{totalItems === 1 ? '' : 's'}
                        </span>
                        <span className="inline-flex min-h-[1.9rem] items-center rounded-full bg-white px-[0.65rem] py-[0.2rem] text-[0.68rem] font-bold uppercase tracking-[0.08em] text-[var(--g-ink-muted)]">
                            {subtotal === null
                                ? 'Mixed pricing'
                                : `৳${subtotal.toLocaleString('en-US')}`}
                        </span>
                    </div>

                    <div className="flex min-h-0 min-w-0 flex-col gap-[0.72rem] overflow-y-auto overflow-x-hidden px-[0.32rem] pb-[0.84rem] pt-[0.36rem] overscroll-contain [scrollbar-gutter:stable_both-edges] max-h-[calc(100vh-12rem)]">
                        {cartLines.length > 0 ? (
                            cartLines.map((line) => (
                                <div
                                    key={line.productId}
                                    ref={(node) => {
                                        registerCartLine(line.productId, node);
                                    }}
                                    className="relative flex-none grid grid-cols-[4.2rem_minmax(0,1fr)] gap-[0.68rem] overflow-hidden rounded-[1.2rem] bg-white px-3 py-[0.72rem] text-left transition-[transform,background] duration-200 ease-out data-[flash=true]:animate-[grocery-cart-line-flash_760ms_cubic-bezier(0.2,0.9,0.2,1)]"
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
                                        className="grid h-[4.2rem] w-[4.2rem] place-items-center self-stretch overflow-hidden rounded-[1.1rem] bg-white"
                                        aria-hidden="true">
                                        <img
                                            src={line.imageUrl}
                                            alt={line.title}
                                            loading="lazy"
                                            className="h-[3.1rem] w-[3.1rem] object-contain"
                                        />
                                    </div>

                                    <div className="grid min-w-0 content-start gap-[0.14rem]">
                                        <div className="flex min-w-0 items-start justify-between gap-[0.35rem]">
                                            <p
                                                className="m-0 w-full min-w-0 overflow-hidden text-ellipsis text-[0.84rem] font-bold leading-[1.18] text-[var(--g-ink)]"
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

                                        <div className="mt-[0.24rem] grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-[0.55rem]">
                                            <div className="flex items-center gap-[0.3rem] rounded-full bg-white p-[0.24rem]">
                                                <button
                                                    type="button"
                                                    className="flex h-[1.84rem] w-[1.84rem] items-center justify-center rounded-full bg-[var(--g-accent-strong)] text-[0.9rem] text-[#f7fcf8] transition-[transform,background,opacity] duration-200 ease-out hover:-translate-y-0.5 hover:bg-[var(--g-accent)] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-accent)]/40 focus-visible:ring-offset-2"
                                                    aria-label={`Remove one ${line.title}`}
                                                    onClick={() =>
                                                        onAdjustCart(
                                                            line.productId,
                                                            -1,
                                                        )
                                                    }>
                                                    -
                                                </button>
                                                <span className="min-w-[1.2rem] text-center text-[0.8rem] font-bold">
                                                    {line.quantity}
                                                </span>
                                                <button
                                                    type="button"
                                                    className="flex h-[1.84rem] w-[1.84rem] items-center justify-center rounded-full bg-[var(--g-accent-strong)] text-[0.9rem] text-[#f7fcf8] transition-[transform,background,opacity] duration-200 ease-out hover:-translate-y-0.5 hover:bg-[var(--g-accent)] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-accent)]/40 focus-visible:ring-offset-2"
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

                                            <div className="grid min-w-0 justify-items-end gap-[0.08rem]">
                                                <span className="whitespace-nowrap text-[0.64rem] font-bold tracking-[0.02em] text-[rgba(95,119,107,0.86)]">
                                                    {line.price === null
                                                        ? 'Price on request'
                                                        : `৳${line.price.toLocaleString('en-US')} each`}
                                                </span>
                                                <strong className="whitespace-nowrap text-[0.94rem] leading-none text-right">
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
                            <div className="flex flex-none items-start gap-[0.2rem] rounded-[1.2rem] bg-white px-4 py-4">
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
