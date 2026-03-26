import { arrayMove } from '@dnd-kit/sortable';
import { insertAt } from '../lib/array.ts';
import type { TTask, TAction } from '../types.ts';

type TSection = 'incomplete' | 'completed';

const findSection = (tasks: ReadonlyArray<TTask>, id: string): TSection | null =>
    id === 'incomplete' ? 'incomplete'
    : id === 'completed' ? 'completed'
    : tasks.find((t) => t.id === id && !t.completed) ? 'incomplete'
    : tasks.find((t) => t.id === id && t.completed) ? 'completed'
    : null;

const isCompleted = (section: TSection): boolean => section === 'completed';

const splitByCompletion = (tasks: ReadonlyArray<TTask>): {
    readonly incomplete: ReadonlyArray<TTask>;
    readonly completed: ReadonlyArray<TTask>;
} => ({
    incomplete: tasks.filter((t) => !t.completed),
    completed: tasks.filter((t) => t.completed),
});

const dragOver = (state: ReadonlyArray<TTask>, activeID: string, overID: string): ReadonlyArray<TTask> => {
    const activeSection = findSection(state, activeID);
    const overSection = findSection(state, overID);
    if (!activeSection || !overSection || activeSection === overSection) {
        return state;
    }

    const activeTask = state.find((t) => t.id === activeID);
    if (!activeTask) {
        return state;
    }

    const updated = { ...activeTask, completed: isCompleted(overSection) };
    const without = state.filter((t) => t.id !== activeID);
    const targetSection = without.filter((t) => t.completed === updated.completed);
    const otherSection = without.filter((t) => t.completed !== updated.completed);
    const overIndex = targetSection.findIndex((t) => t.id === overID);
    const inserted = insertAt(targetSection, overIndex, updated);

    return updated.completed
        ? [...otherSection, ...inserted]
        : [...inserted, ...otherSection];
};

const dragReorder = (state: ReadonlyArray<TTask>, activeID: string, overID: string): ReadonlyArray<TTask> => {
    const activeTask = state.find((t) => t.id === activeID);
    const overTask = state.find((t) => t.id === overID);
    if (!activeTask || !overTask || activeTask.completed !== overTask.completed) {
        return state;
    }

    const section = state.filter((t) => t.completed === activeTask.completed);
    const other = state.filter((t) => t.completed !== activeTask.completed);
    const fromIdx = section.findIndex((t) => t.id === activeID);
    const toIdx = section.findIndex((t) => t.id === overID);
    if (fromIdx === -1 || toIdx === -1) {
        return state;
    }

    const reordered = arrayMove([...section], fromIdx, toIdx);
    return activeTask.completed
        ? [...other, ...reordered]
        : [...reordered, ...other];
};

export const taskReducer = (state: ReadonlyArray<TTask>, action: TAction): ReadonlyArray<TTask> => {
    switch (action.type) {
        case 'REPLACE_ALL':
            return action.tasks;
        case 'ADD_TASK':
            return [
                ...state,
                {
                    id: action.id,
                    text: action.text,
                    dueDate: action.dueDate,
                    completed: false,
                },
            ];
        case 'DELETE_TASK':
            return state.filter((t) => t.id !== action.id);
        case 'TOGGLE_TASK':
            return state.map((t) => (t.id === action.id ? { ...t, completed: !t.completed } : t));
        case 'UPDATE_TASK':
            return state.map((t) => (t.id === action.id ? { ...t, text: action.text, dueDate: action.dueDate } : t));
        case 'DRAG_OVER':
            return dragOver(state, action.activeID, action.overID);
        case 'DRAG_REORDER':
            return dragReorder(state, action.activeID, action.overID);
    }
};

export { splitByCompletion };
