import { differenceInDays, formatDistanceToNow, parseISO } from 'date-fns';

export const formatRelativeDate = (dueDate: string): string => {
    const raw = formatDistanceToNow(parseISO(dueDate), { addSuffix: true });
    return raw.endsWith(' ago') ? raw.replace(' ago', ' overdue') : raw;
};

const URGENCY_THRESHOLDS = Object.freeze([
    { maxDays: -30, className: 'text-orange-900/70' },
    { maxDays: -7, className: 'text-orange-700/70' },
    { maxDays: 0, className: 'text-amber-600/70' },
    { maxDays: 3, className: 'text-amber-500/70' },
    { maxDays: 8, className: 'text-yellow-600/70' },
    { maxDays: 31, className: 'text-yellow-500/70' },
    { maxDays: 91, className: 'text-lime-700/70' },
] as const);

export const dueDateColorClass = (dueDate: string): string => {
    const days = differenceInDays(parseISO(dueDate), new Date());
    return URGENCY_THRESHOLDS.find((t) => days < t.maxDays)?.className ?? 'text-lime-800/70';
};
