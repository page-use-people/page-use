import {memo, useEffect, useRef, useState, type CSSProperties} from 'react';
import type {TCartLine} from '../lib/cart.ts';
import {useRegistryCallbacks} from '../contexts/element-registry-context.ts';
import {useAgentTarget} from '../contexts/agent-target-context.ts';

export type {TCartLine} from '../lib/cart.ts';

type TCartPanelProps = {
    readonly isOpen: boolean;
    readonly isPulsing: boolean;
    readonly cartLines: readonly TCartLine[];
    readonly totalItems: number;
    readonly subtotal: number | null;
    readonly onAdjustCart: (productId: number, delta: number) => void;
    readonly onToggle: () => void;
    readonly onClose: () => void;
};

export const CartPanel = memo(
    ({
        isOpen,
        isPulsing,
        cartLines,
        totalItems,
        subtotal,
        onAdjustCart,
        onToggle,
        onClose,
    }: TCartPanelProps) => {
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
                className="fixed bottom-5 right-5 z-[66] flex min-w-0 flex-col-reverse items-end gap-3.5 max-[560px]:bottom-3.5 max-[560px]:right-3.5"
                data-open={isOpen ? 'true' : 'false'}>
                <button
                    type="button"
                    className="group relative z-[1] inline-flex min-h-14 items-center gap-2.5 rounded-full border border-transparent bg-[var(--g-accent-strong)] px-[0.78rem] py-[0.72rem] text-[#f6fcf7] shadow-[0_26px_46px_rgba(31,73,55,0.18),inset_0_1px_rgba(255,255,255,0.12)] transition-[transform,box-shadow,background] duration-200 ease-out hover:-translate-y-0.5 hover:bg-[var(--g-accent)] hover:shadow-[0_32px_58px_rgba(31,73,55,0.24),inset_0_1px_rgba(255,255,255,0.14)] data-[open=true]:-translate-y-0.5 data-[open=true]:shadow-[0_32px_58px_rgba(31,73,55,0.24),inset_0_1px_rgba(255,255,255,0.14)] data-[pulse=true]:animate-[grocery-cart-bump_480ms_cubic-bezier(0.22,1,0.36,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-accent)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f7fcf6]"
                    data-open={isOpen ? 'true' : 'false'}
                    data-pulse={isPulsing ? 'true' : 'false'}
                    onClick={onToggle}
                    aria-label={`Cart, ${totalItems} item${totalItems === 1 ? '' : 's'}`}
                    aria-expanded={isOpen}
                    aria-controls="grocery-cart-drawer">
                    <span
                        className="flex h-[2.4rem] w-[2.4rem] flex-shrink-0 items-center justify-center rounded-full bg-white/10 font-bold"
                        aria-hidden="true">
                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            className="h-[1.2rem] w-[1.2rem]">
                            <path d="M6 8.5h12l-1 10H7l-1-10Z" />
                            <path d="M9.25 9V7.75a2.75 2.75 0 0 1 5.5 0V9" />
                        </svg>
                    </span>
                    <span className="flex min-h-8 min-w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#efd487] px-[0.45rem] text-[0.88rem] font-bold text-[#254431]">
                        {totalItems}
                    </span>
                </button>

                <section
                    id="grocery-cart-drawer"
                    className="relative grid w-[min(19.5rem,calc(100vw-2.5rem))] min-w-0 origin-bottom-right grid-rows-[auto_minmax(0,1fr)] gap-[0.65rem] overflow-hidden rounded-[1.55rem] border border-[var(--g-border)] bg-[rgba(250,253,248,0.96)] p-4 shadow-[0_24px_54px_rgba(31,73,55,0.14),inset_0_1px_rgba(255,255,255,0.92)] backdrop-blur-[10px] transition-[transform,opacity,max-height,padding,border-color,box-shadow] duration-300 ease-out data-[open=false]:pointer-events-none data-[open=false]:max-h-0 data-[open=false]:border-transparent data-[open=false]:pb-0 data-[open=false]:pt-0 data-[open=false]:opacity-0 data-[open=false]:translate-y-2 data-[open=false]:scale-[0.98] data-[open=true]:pointer-events-auto data-[open=true]:max-h-[min(38rem,calc(100vh-5.75rem))] data-[open=true]:opacity-100 data-[open=true]:translate-y-0 data-[open=true]:scale-100 data-[agent-active=true]:shadow-[0_0_0_0.32rem_rgba(47,122,86,0.1),0_24px_54px_rgba(31,73,55,0.14),inset_0_1px_rgba(255,255,255,0.92)] max-[760px]:w-[min(22rem,calc(100vw-2rem))] max-[760px]:h-auto max-[760px]:max-h-[min(31rem,calc(100vh-7rem))] max-[560px]:w-[min(18.5rem,calc(100vw-1.8rem))] max-[560px]:rounded-[1.35rem] max-[560px]:p-[0.96rem] max-[560px]:max-h-[min(24rem,calc(100vh-6.2rem))]"
                    data-open={isOpen ? 'true' : 'false'}
                    data-agent-active={isAgentActive ? 'true' : 'false'}
                    ref={registerCartPanel}>
                    <div className="flex items-center justify-between gap-[0.65rem] px-[0.12rem] pr-[0.16rem]">
                        <div className="flex min-w-0 flex-wrap items-center gap-[0.45rem]">
                            <span className="inline-flex min-h-[1.9rem] items-center rounded-full border border-[var(--g-border)] bg-white/72 px-[0.65rem] py-[0.2rem] text-[0.68rem] font-bold uppercase tracking-[0.08em] text-[var(--g-ink-muted)]">
                                {totalItems} item{totalItems === 1 ? '' : 's'}
                            </span>
                            <span className="inline-flex min-h-[1.9rem] items-center rounded-full border border-[var(--g-border)] bg-white/72 px-[0.65rem] py-[0.2rem] text-[0.68rem] font-bold uppercase tracking-[0.08em] text-[var(--g-ink-muted)]">
                                {subtotal === null
                                    ? 'Mixed pricing'
                                    : `৳${subtotal.toLocaleString('en-US')}`}
                            </span>
                        </div>
                        <button
                            type="button"
                            className="inline-flex h-[2.55rem] w-[2.55rem] items-center justify-center rounded-full bg-[rgba(33,85,62,0.08)] p-0 text-[var(--g-ink)] transition-[transform,background] duration-200 ease-out hover:-translate-y-0.5 hover:bg-[rgba(33,85,62,0.14)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-accent)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f7fcf6]"
                            aria-label="Minimize basket"
                            onClick={onClose}>
                            <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                className="h-[1.1rem] w-[1.1rem]">
                                <path d="M6 12h12" />
                                <path d="m15 8 4 4-4 4" />
                            </svg>
                        </button>
                    </div>

                    <div className="flex min-h-0 min-w-0 flex-col gap-[0.72rem] overflow-y-auto overflow-x-hidden px-[0.32rem] pb-[0.84rem] pt-[0.36rem] overscroll-contain [scrollbar-gutter:stable_both-edges]">
                        {cartLines.length > 0 ? (
                            cartLines.map((line) => (
                                <div
                                    key={line.productId}
                                    ref={(node) => {
                                        registerCartLine(line.productId, node);
                                    }}
                                    className="relative flex-none grid grid-cols-[4.2rem_minmax(0,1fr)] gap-[0.68rem] overflow-hidden rounded-[1.2rem] border border-[rgba(23,52,40,0.12)] bg-clip-padding px-3 py-[0.72rem] text-left transition-[transform,border-color,background,box-shadow] duration-200 ease-out data-[agent-active=true]:border-[rgba(47,122,86,0.22)] data-[agent-active=true]:shadow-[inset_0_0_0_1px_rgba(47,122,86,0.16),0_18px_30px_rgba(31,73,55,0.08)] data-[flash=true]:animate-[grocery-cart-line-flash_760ms_cubic-bezier(0.2,0.9,0.2,1)] data-[flash=true]:border-[rgba(216,161,63,0.84)] data-[flash=true]:shadow-[inset_0_0_0_1px_rgba(216,161,63,0.44),inset_0_0_0_0.32rem_rgba(216,161,63,0.12),0_18px_30px_rgba(47,122,86,0.08)] max-[560px]:grid-cols-[auto_minmax(0,1fr)]"
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
                                        className="grid h-[4.2rem] w-[4.2rem] place-items-center self-stretch overflow-hidden rounded-[1.1rem] border border-[rgba(23,52,40,0.1)] bg-white/86"
                                        aria-hidden="true">
                                        <img
                                            src={line.imageUrl}
                                            alt={line.title}
                                            loading="lazy"
                                            className="h-[3.1rem] w-[3.1rem] object-contain"
                                        />
                                    </div>

                                    <div className="grid min-w-0 content-start gap-[0.14rem]">
                                        <div className="flex min-w-0 items-start justify-between gap-[0.35rem] max-[560px]:flex-col max-[560px]:items-start">
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

                                        <div className="mt-[0.24rem] grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-[0.55rem] max-[560px]:grid-cols-1 max-[560px]:justify-items-start">
                                            <div className="flex items-center gap-[0.3rem] rounded-full bg-white/82 p-[0.24rem] shadow-[inset_0_1px_rgba(255,255,255,0.9)]">
                                                <button
                                                    type="button"
                                                    className="flex h-[1.84rem] w-[1.84rem] items-center justify-center rounded-full border border-transparent bg-[var(--g-accent-strong)] text-[0.9rem] text-[#f7fcf8] transition-[transform,background,opacity] duration-200 ease-out hover:-translate-y-0.5 hover:bg-[var(--g-accent)] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-accent)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f7fcf6]"
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
                                                    className="flex h-[1.84rem] w-[1.84rem] items-center justify-center rounded-full border border-transparent bg-[var(--g-accent-strong)] text-[0.9rem] text-[#f7fcf8] transition-[transform,background,opacity] duration-200 ease-out hover:-translate-y-0.5 hover:bg-[var(--g-accent)] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-accent)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f7fcf6]"
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

                                            <div className="grid min-w-0 justify-items-end gap-[0.08rem] max-[560px]:justify-items-start">
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
                            <div className="flex flex-none items-start gap-[0.2rem] rounded-[1.2rem] border border-[var(--g-border)] bg-[rgba(239,247,238,0.88)] px-4 py-4">
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
        previousProps.isOpen === nextProps.isOpen &&
        previousProps.isPulsing === nextProps.isPulsing &&
        previousProps.cartLines === nextProps.cartLines &&
        previousProps.totalItems === nextProps.totalItems &&
        previousProps.subtotal === nextProps.subtotal,
);

CartPanel.displayName = 'CartPanel';
