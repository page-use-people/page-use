import clsx from 'clsx';
import { useState, useReducer, useEffect, useMemo, useRef, useCallback } from 'react';
import { flushSync } from 'react-dom';
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
import { PageUseChat, SystemPrompt, useAgentVariable, useAgentFunction } from '@page-use/react';
import z from 'zod';
import TodoItem from './TodoItem.tsx';
import ConfirmModal from './ConfirmModal.tsx';

export type TTodoItem = {
    id: string;
    text: string;
    dueDate: string;
    completed: boolean;
};

type TAction =
    | { type: 'ADD'; id: string; text: string; dueDate: string }
    | { type: 'DELETE'; id: string }
    | { type: 'TOGGLE'; id: string }
    | { type: 'UPDATE'; id: string; text: string; dueDate: string }
    | { type: 'REORDER'; items: TTodoItem[] }
    | { type: 'CLEAR_ALL' }
    | { type: 'SHUFFLE' }
    | { type: 'REPLACE'; data: TTodoItem[] };

const STORAGE_KEY = 'todo-items';

const loadItems = (): TTodoItem[] => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
};

const todoItemsSchema = z
    .array(
        z.object({
            id: z.string().describe('unique identifier for the todo item'),
            text: z.string().describe('the todo item description'),
            dueDate: z
                .string()
                .regex(/^($|([0-9]{4}-[0-9]{2}-[0-9]{2}$))/)
                .describe('due date in YYYY-MM-DD format, or empty string if none'),
            completed: z.boolean().describe('whether the item is completed'),
        }),
    )
    .describe('the current list of all todo items');

// const promptChips = [
//     {
//         label: 'Add a task for today',
//         prompt: 'Add a todo item to buy groceries with today as the due date.',
//     },
//     {
//         label: 'What should I focus on?',
//         prompt: 'Look at my current todos and suggest which one I should focus on first based on due dates.',
//     },
// ];

const reducer = (state: TTodoItem[], action: TAction): TTodoItem[] => {
    switch (action.type) {
        case 'REPLACE':
            return action.data;
        case 'ADD':
            return [
                ...state,
                {
                    id: action.id,
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
        case 'SHUFFLE': {
            const incompleteItems = state.filter((i) => !i.completed);
            const completedItems = state.filter((i) => i.completed);
            const shuffled = [...incompleteItems];
            for (let i = shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
            return [...shuffled, ...completedItems];
        }
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
            <h2 className="mb-2 text-sm uppercase tracking-wide text-stone-700/60">{title}</h2>
            <div
                ref={setNodeRef}
                className={clsx(
                    'min-h-[48px] border-dashed transition-colors',
                    isOver ? 'border-amber-400/30 bg-amber-100/30' : 'border-transparent',
                )}>
                {isEmpty ? <p className="py-3 text-sm text-amber-400/50">Time to get doing.</p> : children}
            </div>
        </div>
    );
};

const Previous = () => {
    const [items, dispatch] = useReducer(reducer, undefined, loadItems);

    useAgentVariable('items', {
        schema: todoItemsSchema,
        value: items,
    });

    const [highlightedIDs, setHighlightedIDs] = useState<ReadonlySet<string>>(new Set());
    const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const highlightItems = useCallback((ids: ReadonlyArray<string>) => {
        if (highlightTimerRef.current) {
            clearTimeout(highlightTimerRef.current);
        }
        setHighlightedIDs(new Set(ids));
        highlightTimerRef.current = setTimeout(() => {
            setHighlightedIDs(new Set());
            highlightTimerRef.current = null;
        }, 1500);
    }, []);

    useAgentFunction('setItems', {
        inputSchema: todoItemsSchema,
        mutates: ['items'],
        func: (newItems) => {
            const changedIDs = newItems
                .filter((ni) => {
                    const old = items.find((o) => o.id === ni.id);
                    return !old || old.text !== ni.text || old.completed !== ni.completed || old.dueDate !== ni.dueDate;
                })
                .map((i) => i.id);
            const transition = document.startViewTransition(() =>
                flushSync(() => dispatch({ type: 'REPLACE', data: newItems })),
            );
            transition.finished.then(() => highlightItems(changedIDs));
        },
    });

    const [newItemId, setNewItemId] = useState<string | null>(null);
    const textareaRefs = useRef<Map<string, HTMLTextAreaElement>>(new Map());
    const [showClearModal, setShowClearModal] = useState(false);
    const [activeId, setActiveId] = useState<string | null>(null);

    const incomplete = useMemo(() => items.filter((i) => !i.completed), [items]);
    const completed = useMemo(() => items.filter((i) => i.completed), [items]);

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    }, [items]);

    const sensors = useSensors(useSensor(PointerSensor));

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
        highlightItems([active.id as string]);
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
        highlightItems([active.id as string]);
    };

    return (
        <>
            <SystemPrompt>
                {`
                    You are a helpful todo list assistant.
                
                    For Context:
                    - You help me manage my tasks in a todo list app.
                    - The app has two sections: "To Do" (incomplete) and "Completed"
                    - Each item has a text description, an optional due date, and a completion status.
                    - Items can be dragged between sections, but you manage them via functions.
                    - You can add new todos, delete existing ones, toggle their completion status, and clear all items.
                `}
            </SystemPrompt>

            <div className="min-h-screen text-stone-800 px-4 py-8 mb-32">
                <div className="mx-auto max-w-lg">
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCorners}
                        onDragStart={handleDragStart}
                        onDragOver={handleDragOver}
                        onDragEnd={handleDragEnd}>
                        <DroppableSection id="incomplete" title={'TO DO'} isEmpty={incomplete.length === 0}>
                            <SortableContext items={incomplete.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                                <div className="space-y-2">
                                    {incomplete.map((item, idx) => (
                                        <TodoItem
                                            key={item.id}
                                            item={item}
                                            autoFocus={item.id === newItemId}
                                            highlighted={highlightedIDs.has(item.id)}
                                            textareaRef={(el) => {
                                                if (el) textareaRefs.current.set(item.id, el);
                                                else textareaRefs.current.delete(item.id);
                                            }}
                                            onToggle={() => {
                                                dispatch({ type: 'TOGGLE', id: item.id });
                                                highlightItems([item.id]);
                                            }}
                                            onDelete={() => dispatch({ type: 'DELETE', id: item.id })}
                                            onUpdate={(text, dueDate) =>
                                                dispatch({ type: 'UPDATE', id: item.id, text, dueDate })
                                            }
                                            onAddBelow={() => {
                                                const id = crypto.randomUUID();
                                                setNewItemId(id);
                                                dispatch({ type: 'ADD', id, text: '', dueDate: '' });
                                            }}
                                            onDeleteFocusPrev={() => {
                                                const prevItem = incomplete[idx - 1];
                                                dispatch({ type: 'DELETE', id: item.id });
                                                if (prevItem) {
                                                    setTimeout(() => {
                                                        const ta = textareaRefs.current.get(prevItem.id);
                                                        if (ta) {
                                                            ta.focus();
                                                            ta.setSelectionRange(ta.value.length, ta.value.length);
                                                        }
                                                    }, 0);
                                                }
                                            }}
                                        />
                                    ))}
                                </div>
                            </SortableContext>
                        </DroppableSection>
                        <div className={'text-center py-2 px-8'}>
                            <button
                                onClick={() => {
                                    const id = crypto.randomUUID();
                                    setNewItemId(id);
                                    dispatch({ type: 'ADD', id, text: '', dueDate: '' });
                                }}
                                className="mt-2 flex items-center gap-1 text-sm text-stone-600/60 transition-colors hover:text-stone-800">
                                + Add Task
                            </button>
                        </div>
                        <DroppableSection id="completed" title="Done" isEmpty={completed.length === 0}>
                            <SortableContext items={completed.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                                <div className="space-y-2">
                                    {completed.map((item) => (
                                        <TodoItem
                                            key={item.id}
                                            item={item}
                                            highlighted={highlightedIDs.has(item.id)}
                                            onToggle={() => {
                                                dispatch({ type: 'TOGGLE', id: item.id });
                                                highlightItems([item.id]);
                                            }}
                                            onDelete={() => dispatch({ type: 'DELETE', id: item.id })}
                                            onUpdate={(text, dueDate) =>
                                                dispatch({ type: 'UPDATE', id: item.id, text, dueDate })
                                            }
                                            onAddBelow={() => {
                                                const id = crypto.randomUUID();
                                                setNewItemId(id);
                                                dispatch({ type: 'ADD', id, text: '', dueDate: '' });
                                            }}
                                        />
                                    ))}
                                </div>
                            </SortableContext>
                        </DroppableSection>
                        <DragOverlay>
                            {activeId
                                ? (() => {
                                      const item = items.find((i) => i.id === activeId);
                                      return item ? (
                                          <div className="flex items-start gap-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 shadow-lg">
                                              <span className="-mt-0.5 text-amber-400/50">⠿</span>
                                              <input
                                                  type="checkbox"
                                                  checked={item.completed}
                                                  readOnly
                                                  className="mt-0.5 h-4 w-4 accent-amber-700 opacity-50"
                                              />
                                              <textarea
                                                  value={item.text}
                                                  readOnly
                                                  rows={1}
                                                  style={{ fieldSizing: 'content' } as React.CSSProperties}
                                                  className={clsx(
                                                      'flex-1 resize-none bg-transparent p-0 text-sm outline-none',
                                                      item.completed && 'text-stone-400 line-through',
                                                  )}
                                              />
                                              <input
                                                  type="date"
                                                  value={item.dueDate}
                                                  readOnly
                                                  className={clsx(
                                                      'mt-0.5 bg-transparent text-xs outline-none opacity-40',
                                                      item.completed ? 'text-amber-400/50' : 'text-amber-700/70',
                                                  )}
                                              />
                                              <button className="-mt-0.5 text-amber-400/50" aria-label="Delete">
                                                  ✕
                                              </button>
                                          </div>
                                      ) : null;
                                  })()
                                : null}
                        </DragOverlay>
                    </DndContext>
                    {/*{incomplete.length > 1 && (*/}
                    {/*    <button*/}
                    {/*        className="mt-4 w-full rounded border border-gray-300 py-2 text-sm text-black/40 transition-colors hover:border-black hover:text-black"*/}
                    {/*        onClick={() => {*/}
                    {/*            const incompleteIDs = items.filter((i) => !i.completed).map((i) => i.id);*/}
                    {/*            const transition = document.startViewTransition(() =>*/}
                    {/*                flushSync(() => dispatch({ type: 'SHUFFLE' })),*/}
                    {/*            );*/}
                    {/*            transition.finished.then(() => highlightItems(incompleteIDs));*/}
                    {/*        }}>*/}
                    {/*        Randomize*/}
                    {/*    </button>*/}
                    {/*)}*/}
                    {/*{items.length > 0 && (*/}
                    {/*    <button*/}
                    {/*        className="mt-2 w-full rounded border border-gray-300 py-2 text-sm text-black/40 transition-colors hover:border-black hover:text-black"*/}
                    {/*        onClick={() => setShowClearModal(true)}>*/}
                    {/*        Clear All*/}
                    {/*    </button>*/}
                    {/*)}*/}
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

            <PageUseChat
                title={'Task Master'}
                greeting={`Hi, I'm the _Task Master_. I help you manage your todo list.`}
                theme="dark"
                placeholder={'Write to Task Master'}
                roundedness={'sm'}
                icon={({ location }) => <span className={location === 'launcher' ? 'text-3xl' : 'text-xl'}>🐼</span>}
                cssVariables={{
                    '--pu-bg': '#292217',
                    '--pu-fg': '#eae7d6',
                    '--pu-surface': '#423c2c',
                    '--pu-muted': '#776d55',
                    '--pu-divider': '#433425',
                    '--pu-accent': '#af9055',
                    '--pu-shadow': '0 25px 60px rgba(6,4,0,0.65)',
                }}
                devMode
            />
        </>
    );
};

export default Previous;
