import { STORAGE_KEY } from '../constants.ts';
import type { TTask } from '../types.ts';

export const loadTasks = (): ReadonlyArray<TTask> => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
};

export const saveTasks = (tasks: ReadonlyArray<TTask>): void => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
};
