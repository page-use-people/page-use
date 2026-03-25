import {forwardRef, type RefObject} from 'react';

type TFauxCursorProps = {
    readonly labelRef: RefObject<HTMLDivElement | null>;
};

export const FauxCursor = forwardRef<HTMLDivElement, TFauxCursorProps>(
    ({labelRef}, ref) => (
        <div
            ref={ref}
            className="group fixed left-0 top-0 z-[70] h-[1.2rem] w-[1.2rem] pointer-events-none opacity-0 transition-opacity duration-150 ease-out will-change-[transform,opacity] data-[clicking=true]:scale-[0.92]"
            aria-hidden="true">
            <div className="absolute inset-0 rounded-full border border-[rgba(255,248,240,0.86)] shadow-[0_0_0_8px_rgba(20,12,16,0.16)] group-data-[mode=search]:shadow-[0_0_0_8px_rgba(208,107,52,0.18)] group-data-[mode=cart]:shadow-[0_0_0_8px_rgba(240,192,58,0.18)]" />
            <div className="absolute inset-[0.28rem] rounded-full bg-[rgba(255,248,240,0.95)]" />
            <div
                ref={labelRef}
                className="absolute left-[0.6rem] top-[1.5rem] min-w-max rounded-full bg-[rgba(22,13,18,0.92)] px-[0.55rem] py-[0.35rem] text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-[#f8f0e6]"
            />
        </div>
    ),
);

FauxCursor.displayName = 'FauxCursor';
