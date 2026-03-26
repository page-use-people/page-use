import type {ReactNode} from 'react';

type TAppShellProps = {
    readonly loadError: string | null;
    readonly sidebar: ReactNode;
    readonly cart: ReactNode;
    readonly children: ReactNode;
};

export const AppShell = ({loadError, sidebar, children, cart}: TAppShellProps) => (
    <div className="grocery-app-shell min-h-screen bg-white text-[var(--g-ink)]">
        <header className="relative z-10 mx-auto mb-4 flex max-w-[1380px] min-w-0 items-start justify-between gap-4 px-5 pt-5 max-md:px-3.5">
            <div className="grid min-w-0 gap-2">
                <h1 className="font-[var(--font-display)] text-[clamp(2.1rem,3vw,3rem)] font-semibold leading-none tracking-tight">
                    Atelier Basket
                </h1>
            </div>
        </header>

        {loadError ? (
            <main className="relative z-10 mx-auto mt-24 grid max-w-2xl min-w-0 place-items-center gap-2 px-4 py-9 text-center">
                <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--g-ink-muted)]">
                    Catalog unavailable
                </p>
                <h2 className="max-w-[18ch] font-[var(--font-display)] text-[clamp(2.5rem,7vw,4rem)] font-semibold leading-none tracking-tight">
                    {loadError}
                </h2>
            </main>
        ) : (
            <main className="relative z-10 mx-auto grid max-w-[1380px] min-w-0 grid-cols-[15rem_1fr_20rem] gap-5 px-5 pb-20 max-lg:grid-cols-[1fr_20rem] max-md:grid-cols-1 max-md:px-3.5">
                <aside className="max-lg:hidden">{sidebar}</aside>
                <div className="min-w-0">{children}</div>
                <div className="min-w-0">{cart}</div>
            </main>
        )}
    </div>
);
