import type {ReactNode} from 'react';

type TAppShellProps = {
    readonly loadError: string | null;
    readonly isCartOpen: boolean;
    readonly children: ReactNode;
};

export const AppShell = ({loadError, isCartOpen, children}: TAppShellProps) => (
    <div className="grocery-app-shell min-h-screen bg-[#fbfcfa] px-5 pb-20 pt-5 text-[var(--g-ink)] max-[760px]:px-[0.9rem] max-[760px]:pb-[7.5rem]">
        <header className="relative z-[1] mx-auto mb-4 flex max-w-[1380px] min-w-0 items-start justify-between gap-4 max-[760px]:flex-col max-[760px]:items-start">
            <div className="grid min-w-0 gap-[0.45rem]">
                <h1 className="font-[var(--font-display)] text-[clamp(2.1rem,3vw,3rem)] font-semibold leading-[0.96] tracking-[-0.03em]">
                    Atelier Basket
                </h1>
            </div>
        </header>

        {loadError ? (
            <main className="relative z-[1] mx-auto mt-24 grid max-w-[42rem] min-w-0 place-items-center gap-[0.45rem] px-[1.1rem] py-[2.25rem] text-center">
                <p className="inline-flex items-center gap-[0.45rem] text-[0.74rem] font-bold uppercase tracking-[0.22em] text-[var(--g-ink-muted)]">
                    Catalog unavailable
                </p>
                <h2 className="max-w-[18ch] font-[var(--font-display)] text-[clamp(2.5rem,7vw,4rem)] font-semibold leading-[0.96] tracking-[-0.03em]">
                    {loadError}
                </h2>
            </main>
        ) : (
            <main className="relative z-[1] mx-auto max-w-[1380px] min-w-0">
                <div
                    className="grocery-main-layout block px-[clamp(3rem,4vw,4.75rem)] transition-[padding,max-width] duration-[280ms] ease-out data-[cart-open=true]:pl-[clamp(3.25rem,4.6vw,4.75rem)] data-[cart-open=true]:pr-[clamp(20rem,22vw,22.5rem)] max-[1320px]:data-[cart-open=true]:pr-[clamp(18rem,21vw,20rem)] max-[980px]:px-0 max-[980px]:data-[cart-open=true]:px-0"
                    data-cart-open={isCartOpen ? 'true' : 'false'}>
                    {children}
                </div>
            </main>
        )}
    </div>
);
