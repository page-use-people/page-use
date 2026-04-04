import { useState } from 'react';
import { PointerSensor, useSensor, useSensors, type DragStartEvent, type DragOverEvent, type DragEndEvent } from '@dnd-kit/core';
import type { TAction } from '../types.ts';

export const useDragReorder = (
    dispatch: React.Dispatch<TAction>,
    highlightItems: (ids: ReadonlyArray<string>) => void,
) => {
    const [activeID, setActiveID] = useState<string | null>(null);
    const sensors = useSensors(useSensor(PointerSensor));

    const onDragStart = (event: DragStartEvent) => {
        setActiveID(event.active.id as string);
    };

    const onDragOver = (event: DragOverEvent) => {
        if (!event.over) {
            return;
        }
        dispatch({ type: 'DRAG_OVER', activeID: event.active.id as string, overID: event.over.id as string });
        highlightItems([event.active.id as string]);
    };

    const onDragEnd = (event: DragEndEvent) => {
        setActiveID(null);
        if (!event.over || event.active.id === event.over.id) {
            return;
        }
        dispatch({ type: 'DRAG_REORDER', activeID: event.active.id as string, overID: event.over.id as string });
        highlightItems([event.active.id as string]);
    };

    return { activeID, sensors, onDragStart, onDragOver, onDragEnd } as const;
};
