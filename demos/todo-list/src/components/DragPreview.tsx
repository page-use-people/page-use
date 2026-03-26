import clsx from 'clsx';
import { format, parseISO } from 'date-fns';
import { formatRelativeDate, dueDateColorClass } from '../lib/date.ts';
import type { TTask } from '../types.ts';

const DragPreview = ({ task }: { readonly task: TTask | undefined }) => {
    if (!task) {
        return null;
    }

    return (
        <div
            className={clsx(
                'flex items-start gap-2 border rounded shadow text-stone-800 px-3 py-2',
                task.completed ? 'bg-stone-300 border-stone-400' : 'bg-amber-100 border-yellow-400',
            )}>
            <span className="cursor-grab touch-none text-amber-600/50">⠿</span>
            <input
                type="checkbox"
                checked={task.completed}
                readOnly
                className="mt-1 h-4 w-4 accent-amber-700"
            />
            <textarea
                value={task.text}
                readOnly
                rows={1}
                style={{ fieldSizing: 'content' } as React.CSSProperties}
                className={clsx(
                    'flex-1 resize-none bg-transparent p-0 outline-none',
                    task.completed && 'text-stone-600 line-through',
                )}
            />
            {task.dueDate && (
                task.completed
                    ? <span className="mt-1 text-xs text-stone-500/70 whitespace-nowrap">{format(parseISO(task.dueDate), 'MMM d, yyyy')}</span>
                    : <span className={clsx('mt-1 text-xs font-medium whitespace-nowrap', dueDateColorClass(task.dueDate))}>{formatRelativeDate(task.dueDate)}</span>
            )}
            <button className="mt-1 text-xs text-stone-500/60" aria-label="Delete">
                ✕
            </button>
        </div>
    );
};

export default DragPreview;
