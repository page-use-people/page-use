import {forwardRef, type RefObject} from 'react';

type TFauxCursorProps = {
    readonly labelRef: RefObject<HTMLDivElement | null>;
};

export const FauxCursor = forwardRef<HTMLDivElement, TFauxCursorProps>(
    ({labelRef}, ref) => (
        <div ref={ref} className="grocery-faux-cursor" aria-hidden="true">
            <div className="grocery-faux-cursor__ring" />
            <div className="grocery-faux-cursor__dot" />
            <div ref={labelRef} className="grocery-faux-cursor__label" />
        </div>
    ),
);

FauxCursor.displayName = 'FauxCursor';
