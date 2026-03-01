import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { TTodoItem } from './App.tsx';

const TodoItem = ({
    item,
    onToggle,
    onDelete,
    onUpdate,
}: {
    item: TTodoItem;
    onToggle: () => void;
    onDelete: () => void;
    onUpdate: (text: string, dueDate: string) => void;
}) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });

    const style = {
        transform: CSS.Translate.toString(transform),
        transition,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`flex items-center gap-2 rounded border border-gray-200 bg-white px-3 py-2 ${isDragging ? 'opacity-30' : ''}`}
        >
            <button
                {...attributes}
                {...listeners}
                className="cursor-grab touch-none text-black/20 hover:text-black/60"
                aria-label="Drag to reorder"
            >
                ⠿
            </button>
            <input type="checkbox" checked={item.completed} onChange={onToggle} className="h-4 w-4 accent-black" />
            <input
                type="text"
                value={item.text}
                onChange={(e) => onUpdate(e.target.value, item.dueDate)}
                className={`flex-1 bg-transparent text-sm outline-none ${
                    item.completed ? 'text-black/40 line-through' : ''
                }`}
            />
            <input
                type="date"
                value={item.dueDate}
                onChange={(e) => onUpdate(item.text, e.target.value)}
                className={`bg-transparent text-xs outline-none ${item.completed ? 'text-black/20' : 'text-black/60'}`}
            />
            <button onClick={onDelete} className="text-black/20 transition-colors hover:text-black" aria-label="Delete">
                ✕
            </button>
        </div>
    );
};

export default TodoItem;
