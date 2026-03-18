import clsx from 'clsx';
import { differenceInDays, format, formatDistanceToNow, parseISO } from 'date-fns';
import { useEffect, useRef, useState } from 'react';

export const formatRelativeDate = (dueDate: string): string => {
    const raw = formatDistanceToNow(parseISO(dueDate), { addSuffix: true });
    return raw.endsWith(' ago') ? raw.replace(' ago', ' overdue') : raw;
};

export const getDateColorClass = (dueDate: string): string => {
    const days = differenceInDays(parseISO(dueDate), new Date());
    if (days < -30) return 'text-orange-900/70';
    if (days < -7) return 'text-orange-700/70';
    if (days < 0) return 'text-amber-600/70';
    if (days < 3) return 'text-amber-500/70';
    if (days < 8) return 'text-yellow-600/70';
    if (days < 31) return 'text-yellow-500/70';
    if (days < 91) return 'text-lime-700/70';
    return 'text-lime-800/70';
};

const DueDateDisplay = ({
    dueDate,
    onChange,
    completed = false,
}: {
    dueDate: string;
    onChange: (v: string) => void;
    completed?: boolean;
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
            className={clsx('mt-1 text-xs font-medium whitespace-nowrap cursor-pointer', getDateColorClass(dueDate))}>
            {formatRelativeDate(dueDate)}
        </button>
    );
};

export default DueDateDisplay;
