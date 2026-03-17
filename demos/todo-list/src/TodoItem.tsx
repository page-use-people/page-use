import clsx from 'clsx';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { TTodoItem } from './Previous.tsx';

const TodoItem = ({
    item,
    onToggle,
    onDelete,
    onUpdate,
    highlighted = false,
}: {
    item: TTodoItem;
    onToggle: () => void;
    onDelete: () => void;
    onUpdate: (text: string, dueDate: string) => void;
    highlighted?: boolean;
}) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });

    const style = transform
        ? { transform: CSS.Translate.toString(transform), transition, viewTransitionName: `todo-${item.id}` }
        : { viewTransitionName: `todo-${item.id}` };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={clsx('flex items-start gap-2 rounded border border-gray-200 bg-white px-3 py-2', isDragging && 'opacity-30', highlighted && 'animate-highlight-fade')}
        >
            <button
                {...attributes}
                {...listeners}
                className="-mt-0.5 cursor-grab touch-none text-black/20 hover:text-black/60"
                aria-label="Drag to reorder"
            >
                ⠿
            </button>
            <input type="checkbox" checked={item.completed} onChange={onToggle} className="mt-0.5 h-4 w-4 accent-black" />
            <textarea
                value={item.text}
                onChange={(e) => onUpdate(e.target.value, item.dueDate)}
                rows={1}
                style={{ fieldSizing: 'content' } as React.CSSProperties}
                className={clsx('flex-1 resize-none bg-transparent p-0 text-sm outline-none', item.completed && 'text-black/40 line-through')}
            />
            <input
                type="date"
                value={item.dueDate}
                onChange={(e) => onUpdate(item.text, e.target.value)}
                className={clsx('mt-0.5 bg-transparent text-xs outline-none', item.completed ? 'text-black/20' : 'text-black/60')}
            />
            <button onClick={onDelete} className="-mt-0.5 text-black/20 transition-colors hover:text-black" aria-label="Delete">
                ✕
            </button>
        </div>
    );
};

export default TodoItem;
