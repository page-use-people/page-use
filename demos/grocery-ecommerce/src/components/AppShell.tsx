import type {ReactNode} from 'react';

type TAppShellProps = {
    readonly loadError: string | null;
    readonly sidebar: ReactNode;
    readonly cart: ReactNode;
    readonly children: ReactNode;
};

export const AppShell = ({loadError, sidebar, children, cart}: TAppShellProps) => (
    <div className="grocery-app-shell min-h-screen bg-white text-[var(--g-ink)]">
        <header className="relative z-[1] mx-auto mb-4 flex max-w-[1380px] min-w-0 items-start justify-between gap-4 px-5 pt-5 max-[760px]:px-[0.9rem]">
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
            <main className="relative z-[1] mx-auto grid max-w-[1380px] min-w-0 grid-cols-[15rem_1fr_20rem] gap-5 px-5 pb-20 max-[980px]:grid-cols-[1fr_20rem] max-[760px]:grid-cols-1 max-[760px]:px-[0.9rem] max-[760px]:pb-[7.5rem]">
                <aside className="max-[980px]:hidden">{sidebar}</aside>
                <div className="min-w-0">{children}</div>
                <div className="min-w-0">{cart}</div>
            </main>
        )}
    </div>
);
