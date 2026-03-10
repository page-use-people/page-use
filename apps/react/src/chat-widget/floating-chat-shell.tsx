import {
    useEffect,
    useLayoutEffect,
    useRef,
    type PointerEventHandler,
    type ReactNode,
} from 'react';

import {
    PANEL_GAP,
    clampPosition,
    getBoxSize,
    getDefaultPosition,
} from './shared.js';

const DRAG_THRESHOLD = 4;

type TPosition = {
    readonly x: number;
    readonly y: number;
};

type TDragHandleKind = 'launcher' | 'panel';

type TDragSession = {
    readonly pointerId: number;
    readonly kind: TDragHandleKind;
    readonly offsetX: number;
    readonly offsetY: number;
    readonly startX: number;
    readonly startY: number;
    active: boolean;
};

export type TDragHandleProps = {
    readonly onPointerDown: PointerEventHandler<HTMLElement>;
    readonly onPointerMove: PointerEventHandler<HTMLElement>;
    readonly onPointerUp: PointerEventHandler<HTMLElement>;
    readonly onPointerCancel: PointerEventHandler<HTMLElement>;
    readonly onLostPointerCapture: PointerEventHandler<HTMLElement>;
};

type TFloatingChatShellRenderProps = {
    readonly launcherDragHandleProps: TDragHandleProps;
    readonly panelDragHandleProps: TDragHandleProps;
    readonly onLauncherClick: () => void;
};

type TFloatingChatShellProps = {
    readonly isOpen: boolean;
    readonly width: number;
    readonly height: number;
    readonly foregroundColor: string;
    readonly onOpen: () => void;
    readonly children: (
        props: TFloatingChatShellRenderProps,
    ) => ReactNode;
};

const useClientLayoutEffect =
    typeof window === 'undefined' ? useEffect : useLayoutEffect;

const createTranslateStyle = ({x, y}: TPosition) =>
    `translate3d(${x}px, ${y}px, 0)`;

export const FloatingChatShell = ({
    isOpen,
    width,
    height,
    foregroundColor,
    onOpen,
    children,
}: TFloatingChatShellProps) => {
    const rootRef = useRef<HTMLDivElement | null>(null);
    const frameRef = useRef<number | null>(null);
    const positionRef = useRef<TPosition>({x: PANEL_GAP, y: PANEL_GAP});
    const queuedPositionRef = useRef<TPosition>(positionRef.current);
    const boxSizeRef = useRef(getBoxSize(isOpen, width, height));
    const dragSessionRef = useRef<TDragSession | null>(null);
    const hasUserPositionRef = useRef(false);
    const suppressLauncherClickRef = useRef(false);

    const applyPosition = (nextPosition: TPosition) => {
        positionRef.current = nextPosition;
        queuedPositionRef.current = nextPosition;

        const root = rootRef.current;
        if (!root) {
            return;
        }

        root.style.transform = createTranslateStyle(nextPosition);
    };

    const syncPositionToViewport = () => {
        const nextBoxSize = boxSizeRef.current;
        const nextPosition = hasUserPositionRef.current
            ? clampPosition(
                  positionRef.current.x,
                  positionRef.current.y,
                  nextBoxSize.width,
                  nextBoxSize.height,
              )
            : getDefaultPosition(nextBoxSize.width, nextBoxSize.height);

        applyPosition(nextPosition);
    };

    const queuePosition = (nextPosition: TPosition) => {
        queuedPositionRef.current = nextPosition;

        if (frameRef.current !== null) {
            return;
        }

        frameRef.current = window.requestAnimationFrame(() => {
            frameRef.current = null;
            applyPosition(queuedPositionRef.current);
        });
    };

    const endDrag = (
        currentTarget?: HTMLElement | null,
        pointerId?: number,
    ) => {
        if (
            currentTarget &&
            pointerId !== undefined &&
            currentTarget.hasPointerCapture(pointerId)
        ) {
            currentTarget.releasePointerCapture(pointerId);
        }

        dragSessionRef.current = null;
    };

    useClientLayoutEffect(() => {
        boxSizeRef.current = getBoxSize(isOpen, width, height);
        syncPositionToViewport();
    }, [height, isOpen, width]);

    useEffect(() => {
        const onResize = () => {
            syncPositionToViewport();
        };

        window.addEventListener('resize', onResize);
        return () => {
            window.removeEventListener('resize', onResize);
        };
    }, []);

    useEffect(() => {
        return () => {
            if (frameRef.current !== null) {
                window.cancelAnimationFrame(frameRef.current);
            }
        };
    }, []);

    const createPointerDownHandler =
        (kind: TDragHandleKind): PointerEventHandler<HTMLElement> =>
        (event) => {
            if (event.button !== 0) {
                return;
            }

            if (kind === 'launcher') {
                suppressLauncherClickRef.current = false;
            }

            dragSessionRef.current = {
                pointerId: event.pointerId,
                kind,
                offsetX: event.clientX - positionRef.current.x,
                offsetY: event.clientY - positionRef.current.y,
                startX: event.clientX,
                startY: event.clientY,
                active: false,
            };
            event.currentTarget.setPointerCapture(event.pointerId);
        };

    const handlePointerMove: PointerEventHandler<HTMLElement> = (event) => {
        const session = dragSessionRef.current;
        if (!session || session.pointerId !== event.pointerId) {
            return;
        }

        if (!session.active) {
            const deltaX = Math.abs(event.clientX - session.startX);
            const deltaY = Math.abs(event.clientY - session.startY);
            if (deltaX <= DRAG_THRESHOLD && deltaY <= DRAG_THRESHOLD) {
                return;
            }

            session.active = true;
            hasUserPositionRef.current = true;

            if (session.kind === 'launcher') {
                suppressLauncherClickRef.current = true;
            }
        }

        queuePosition(
            clampPosition(
                event.clientX - session.offsetX,
                event.clientY - session.offsetY,
                boxSizeRef.current.width,
                boxSizeRef.current.height,
            ),
        );
    };

    const handlePointerUp: PointerEventHandler<HTMLElement> = (event) => {
        const session = dragSessionRef.current;
        if (!session || session.pointerId !== event.pointerId) {
            return;
        }

        endDrag(event.currentTarget, event.pointerId);
    };

    const handlePointerCancel: PointerEventHandler<HTMLElement> = (event) => {
        const session = dragSessionRef.current;
        if (!session || session.pointerId !== event.pointerId) {
            return;
        }

        endDrag(event.currentTarget, event.pointerId);
    };

    const handleLostPointerCapture: PointerEventHandler<HTMLElement> = (
        event,
    ) => {
        const session = dragSessionRef.current;
        if (!session || session.pointerId !== event.pointerId) {
            return;
        }

        endDrag();
    };

    const dragHandleProps: TDragHandleProps = {
        onPointerDown: createPointerDownHandler('launcher'),
        onPointerMove: handlePointerMove,
        onPointerUp: handlePointerUp,
        onPointerCancel: handlePointerCancel,
        onLostPointerCapture: handleLostPointerCapture,
    };

    const panelDragHandleProps: TDragHandleProps = {
        ...dragHandleProps,
        onPointerDown: createPointerDownHandler('panel'),
    };

    const onLauncherClick = () => {
        if (suppressLauncherClickRef.current) {
            suppressLauncherClickRef.current = false;
            return;
        }

        onOpen();
    };

    return (
        <div
            ref={rootRef}
            style={{
                position: 'fixed',
                left: 0,
                top: 0,
                transform: createTranslateStyle(positionRef.current),
                zIndex: 2147483647,
                fontFamily:
                    '"IBM Plex Mono", "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
                color: foregroundColor,
                willChange: 'transform',
            }}>
            {children({
                launcherDragHandleProps: dragHandleProps,
                panelDragHandleProps,
                onLauncherClick,
            })}
        </div>
    );
};
