import clsx from 'clsx';
import { useRef } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { TTodoItem } from './Previous.tsx';

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
                'flex items-start gap-2 border rounded border-gray-300 bg-white px-3 py-2',
                isDragging && 'opacity-30',
                highlighted && 'animate-highlight-fade',
            )}>
            <button
                {...attributes}
                {...listeners}
                className="cursor-grab touch-none text-black/20 hover:text-black/60"
                aria-label="Drag to reorder">
                ⠿
            </button>
            <input type="checkbox" checked={item.completed} onChange={onToggle} className="mt-1 h-4 w-4 accent-black" />
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
                    item.completed && 'text-black/40 line-through',
                )}
            />
            <input
                type="date"
                value={item.dueDate}
                onChange={(e) => onUpdate(item.text, e.target.value)}
                className={clsx(
                    'mt-1 w-20 bg-transparent text-xs outline-none',
                    item.completed ? 'text-black/20' : 'text-black/60',
                )}
            />
            <button
                onClick={onDelete}
                className="  text-black/20 transition-colors hover:text-black"
                aria-label="Delete">
                ✕
            </button>
        </div>
    );
};

export default TodoItem;
