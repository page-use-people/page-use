import clsx from 'clsx';
import { format, parseISO } from 'date-fns';
import { useEffect, useRef, useState } from 'react';
import { formatRelativeDate, dueDateColorClass } from '../lib/date.ts';

const TaskDueDate = ({
    dueDate,
    onChange,
    completed = false,
}: {
    readonly dueDate: string;
    readonly onChange: (v: string) => void;
    readonly completed?: boolean;
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isEditing) inputRef.current?.focus();
    }, [isEditing]);

    if (completed && dueDate) {
        return (
            <span className="mt-1 text-xs text-stone-500/70 whitespace-nowrap">
                {format(parseISO(dueDate), 'MMM d, yyyy')}
            </span>
        );
    }

    if (isEditing || !dueDate) {
        return (
            <input
                ref={inputRef}
                type="date"
                value={dueDate}
                onChange={(e) => onChange(e.target.value)}
                onFocus={() => setIsEditing(true)}
                onBlur={() => setIsEditing(false)}
                className="mt-1 w-20 bg-transparent text-xs outline-none text-stone-700/70"
            />
        );
    }

    return (
        <button
            onClick={() => setIsEditing(true)}
            className={clsx('mt-1 text-xs font-medium whitespace-nowrap cursor-pointer', dueDateColorClass(dueDate))}>
            {formatRelativeDate(dueDate)}
        </button>
    );
};

export default TaskDueDate;
