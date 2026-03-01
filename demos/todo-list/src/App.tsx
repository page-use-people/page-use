import { useState, useReducer, useEffect, useMemo } from 'react';
import {
    DndContext,
    closestCorners,
    DragOverlay,
    PointerSensor,
    useSensor,
    useSensors,
    useDroppable,
    type DragStartEvent,
    type DragOverEvent,
    type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import TodoInput from './TodoInput.tsx';
import TodoItem from './TodoItem.tsx';
import ConfirmModal from './ConfirmModal.tsx';

export type TTodoItem = {
    id: string;
    text: string;
    dueDate: string;
    completed: boolean;
};

type TAction =
    | { type: 'ADD'; text: string; dueDate: string }
    | { type: 'DELETE'; id: string }
    | { type: 'TOGGLE'; id: string }
    | { type: 'UPDATE'; id: string; text: string; dueDate: string }
    | { type: 'REORDER'; items: TTodoItem[] }
    | { type: 'CLEAR_ALL' };

const STORAGE_KEY = 'todo-items';

const loadItems = (): TTodoItem[] => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
};

const reducer = (state: TTodoItem[], action: TAction): TTodoItem[] => {
    switch (action.type) {
        case 'ADD':
            return [
                ...state,
                {
                    id: crypto.randomUUID(),
                    text: action.text,
                    dueDate: action.dueDate,
                    completed: false,
                },
            ];
        case 'DELETE':
            return state.filter((i) => i.id !== action.id);
        case 'TOGGLE':
            return state.map((i) => (i.id === action.id ? { ...i, completed: !i.completed } : i));
        case 'UPDATE':
            return state.map((i) => (i.id === action.id ? { ...i, text: action.text, dueDate: action.dueDate } : i));
        case 'REORDER':
            return action.items;
        case 'CLEAR_ALL':
            return [];
    }
};

const DroppableSection = ({
    id,
    title,
    children,
    isEmpty,
}: {
    id: string;
    title: string;
    children: React.ReactNode;
    isEmpty: boolean;
}) => {
    const { setNodeRef, isOver } = useDroppable({ id });
    return (
        <div className="mt-6">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-black/40">{title}</h2>
            <div
                ref={setNodeRef}
                className={`min-h-[48px] rounded-lg border-2 border-dashed p-2 transition-colors ${isOver ? 'border-black/20 bg-black/[0.03]' : 'border-transparent'}`}
            >
                {isEmpty ? <p className="py-3 text-center text-sm text-black/20">No items</p> : children}
            </div>
        </div>
    );
};

const App = () => {
    const [items, dispatch] = useReducer(reducer, undefined, loadItems);
    const [showClearModal, setShowClearModal] = useState(false);
    const [activeId, setActiveId] = useState<string | null>(null);

    const incomplete = useMemo(() => items.filter((i) => !i.completed), [items]);
    const completed = useMemo(() => items.filter((i) => i.completed), [items]);

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    }, [items]);

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

    const findContainer = (id: string): 'incomplete' | 'completed' | null => {
        if (id === 'incomplete' || incomplete.some((i) => i.id === id)) return 'incomplete';
        if (id === 'completed' || completed.some((i) => i.id === id)) return 'completed';
        return null;
    };

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragOver = (event: DragOverEvent) => {
        const { active, over } = event;
        if (!over) return;

        const activeContainer = findContainer(active.id as string);
        const overContainer = findContainer(over.id as string);
        if (!activeContainer || !overContainer || activeContainer === overContainer) return;

        const activeItem = items.find((i) => i.id === active.id)!;
        const updated = { ...activeItem, completed: overContainer === 'completed' };

        const sourceList = activeContainer === 'incomplete' ? incomplete : completed;
        const targetList = overContainer === 'incomplete' ? [...incomplete] : [...completed];
        const filteredSource = sourceList.filter((i) => i.id !== active.id);

        const overIndex = targetList.findIndex((i) => i.id === over.id);
        targetList.splice(overIndex >= 0 ? overIndex : targetList.length, 0, updated);

        dispatch({
            type: 'REORDER',
            items:
                overContainer === 'incomplete'
                    ? [...targetList, ...filteredSource]
                    : [...filteredSource, ...targetList],
        });
    };

    const handleDragEnd = (event: DragEndEvent) => {
        setActiveId(null);
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const activeContainer = findContainer(active.id as string);
        const overContainer = findContainer(over.id as string);
        if (!activeContainer || !overContainer || activeContainer !== overContainer) return;

        const list = activeContainer === 'incomplete' ? incomplete : completed;
        const other = activeContainer === 'incomplete' ? completed : incomplete;
        const oldIdx = list.findIndex((i) => i.id === active.id);
        const newIdx = list.findIndex((i) => i.id === over.id);
        if (oldIdx === -1 || newIdx === -1) return;

        const reordered = arrayMove(list, oldIdx, newIdx);
        dispatch({
            type: 'REORDER',
            items: activeContainer === 'incomplete' ? [...reordered, ...other] : [...other, ...reordered],
        });
    };

    return (
        <div className="min-h-screen bg-gray-50 px-4 py-8">
            <div className="mx-auto max-w-lg">
                <h1 className="mb-6 text-2xl font-bold">Todo List</h1>
                <TodoInput onAdd={(text, dueDate) => dispatch({ type: 'ADD', text, dueDate })} />
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCorners}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDragEnd={handleDragEnd}
                >
                    <DroppableSection id="incomplete" title="To Do" isEmpty={incomplete.length === 0}>
                        <SortableContext items={incomplete.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                            <div className="space-y-2">
                                {incomplete.map((item) => (
                                    <TodoItem
                                        key={item.id}
                                        item={item}
                                        onToggle={() =>
                                            dispatch({
                                                type: 'TOGGLE',
                                                id: item.id,
                                            })
                                        }
                                        onDelete={() =>
                                            dispatch({
                                                type: 'DELETE',
                                                id: item.id,
                                            })
                                        }
                                        onUpdate={(text, dueDate) =>
                                            dispatch({
                                                type: 'UPDATE',
                                                id: item.id,
                                                text,
                                                dueDate,
                                            })
                                        }
                                    />
                                ))}
                            </div>
                        </SortableContext>
                    </DroppableSection>
                    <DroppableSection id="completed" title="Completed" isEmpty={completed.length === 0}>
                        <SortableContext items={completed.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                            <div className="space-y-2">
                                {completed.map((item) => (
                                    <TodoItem
                                        key={item.id}
                                        item={item}
                                        onToggle={() =>
                                            dispatch({
                                                type: 'TOGGLE',
                                                id: item.id,
                                            })
                                        }
                                        onDelete={() =>
                                            dispatch({
                                                type: 'DELETE',
                                                id: item.id,
                                            })
                                        }
                                        onUpdate={(text, dueDate) =>
                                            dispatch({
                                                type: 'UPDATE',
                                                id: item.id,
                                                text,
                                                dueDate,
                                            })
                                        }
                                    />
                                ))}
                            </div>
                        </SortableContext>
                    </DroppableSection>
                    <DragOverlay>
                        {activeId ? (
                            <div className="flex items-center gap-2 rounded border border-gray-200 bg-white px-3 py-2 shadow-lg">
                                <span className="text-black/20">⠿</span>
                                <span className="text-sm">{items.find((i) => i.id === activeId)?.text}</span>
                            </div>
                        ) : null}
                    </DragOverlay>
                </DndContext>
                {items.length > 0 && (
                    <button
                        className="mt-8 w-full rounded border border-gray-300 py-2 text-sm text-black/40 transition-colors hover:border-black hover:text-black"
                        onClick={() => setShowClearModal(true)}
                    >
                        Clear All
                    </button>
                )}
                <ConfirmModal
                    open={showClearModal}
                    message="Are you sure you want to clear all items?"
                    onConfirm={() => {
                        dispatch({ type: 'CLEAR_ALL' });
                        setShowClearModal(false);
                    }}
                    onCancel={() => setShowClearModal(false)}
                />
            </div>
        </div>
    );
};

export default App;
