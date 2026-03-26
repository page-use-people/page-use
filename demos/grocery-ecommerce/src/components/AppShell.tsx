import type {PropsWithChildren, ReactNode} from 'react';

type TAppShellProps = {
    readonly sidebar: ReactNode;
    readonly cart: ReactNode;
};

export const AppShell = ({
    sidebar,
    children,
    cart,
}: PropsWithChildren<TAppShellProps>) => (
    <div className="grocery-app-shell min-h-screen bg-white text-[var(--g-ink)]">
        <header className="bg-[var(--g-accent-strong)] border-b-1 border-amber-400 relative z-10 mx-auto pb-4 flex min-w-0 items-start justify-between gap-4 px-5 pt-5 max-md:px-3.5">
            <div className="grid min-w-0 gap-2">
                <h1 className="font-[var(--font-display)] text-xl font-semibold leading-none tracking-tight">
                    Atelier Basket
                </h1>
            </div>
        </header>

        <main className="relative z-10 mx-auto grid max-w-[1380px] min-w-0 grid-cols-[15rem_1fr_20rem] gap-2 px-5 pb-20 max-lg:grid-cols-[1fr_20rem] max-md:grid-cols-1 max-md:px-3.5">
            <aside className="max-lg:hidden">{sidebar}</aside>
            <div className="min-w-0">{children}</div>
            <div className="min-w-0">{cart}</div>
        </main>
    </div>
);
