import clsx from 'clsx';
import { useRef } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { TTodoItem } from './Previous.tsx';
import DueDateDisplay from './DueDateDisplay.tsx';

const TodoItem = ({
    item,
    onToggle,
    onDelete,
    onUpdate,
    onAddBelow,
    onDeleteFocusPrev,
    textareaRef,
    highlighted = false,
    autoFocus = false,
}: {
    item: TTodoItem;
    onToggle: () => void;
    onDelete: () => void;
    onUpdate: (text: string, dueDate: string) => void;
    onAddBelow: () => void;
    onDeleteFocusPrev?: () => void;
    textareaRef?: (el: HTMLTextAreaElement | null) => void;
    highlighted?: boolean;
    autoFocus?: boolean;
}) => {
    const backspaceCountRef = useRef(0);
    const lastBackspaceTimeRef = useRef(0);
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });

    const style = transform
        ? { transform: CSS.Translate.toString(transform), transition, viewTransitionName: `todo-${item.id}` }
        : { viewTransitionName: `todo-${item.id}` };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={clsx(
                'flex items-start gap-2 border rounded shadow  text-stone-800 px-3 py-2',
                isDragging && 'opacity-30',
                highlighted && 'animate-highlight-fade',
                item.completed ? 'bg-stone-300 border-stone-400' : 'bg-amber-100 border-yellow-400',
            )}>
            <button
                {...attributes}
                {...listeners}
                className="cursor-grab touch-none text-amber-600/50 hover:text-amber-700"
                aria-label="Drag to reorder">
                ⠿
            </button>
            <input
                type="checkbox"
                checked={item.completed}
                onChange={onToggle}
                className="mt-1 h-4 w-4 accent-amber-700"
            />
            <textarea
                ref={textareaRef}
                value={item.text}
                onChange={(e) => onUpdate(e.target.value, item.dueDate)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        backspaceCountRef.current = 0;
                        onAddBelow();
                    } else if (e.key === 'Backspace' && item.text === '') {
                        const now = Date.now();
                        const elapsed = now - lastBackspaceTimeRef.current;
                        lastBackspaceTimeRef.current = now;
                        backspaceCountRef.current = elapsed <= 300 ? backspaceCountRef.current + 1 : 1;
                        if (backspaceCountRef.current >= 2) {
                            backspaceCountRef.current = 0;
                            onDeleteFocusPrev ? onDeleteFocusPrev() : onDelete();
                        }
                    } else {
                        backspaceCountRef.current = 0;
                    }
                }}
                autoFocus={autoFocus}
                rows={1}
                style={{ fieldSizing: 'content' } as React.CSSProperties}
                className={clsx(
                    'flex-1 resize-none bg-transparent p-0 outline-none',
                    item.completed && 'text-stone-600 line-through',
                )}
            />
            <DueDateDisplay
                dueDate={item.dueDate}
                onChange={(v) => onUpdate(item.text, v)}
                completed={item.completed}
            />
            <button
                onClick={onDelete}
                className="mt-1 text-xs text-stone-500/60 transition-colors hover:text-amber-700"
                aria-label="Delete">
                ✕
            </button>
        </div>
    );
};

export default TodoItem;
