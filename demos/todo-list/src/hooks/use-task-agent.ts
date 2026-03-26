import { useRef } from 'react';
import { flushSync } from 'react-dom';
import { useAgentVariable, useAgentFunction } from '@page-use/react';
import { taskSchema } from '../schema.ts';
import type { TTask, TAction } from '../types.ts';

export const useTaskAgent = (
    tasks: ReadonlyArray<TTask>,
    dispatch: React.Dispatch<TAction>,
    highlightItems: (ids: ReadonlyArray<string>) => void,
) => {
    const tasksRef = useRef(tasks);
    tasksRef.current = tasks;

    useAgentVariable('items', {
        schema: taskSchema,
        value: tasks,
    });

    useAgentFunction('setItems', {
        inputSchema: taskSchema,
        mutates: ['items'],
        func: (newTasks) => {
            const currentTasks = tasksRef.current;
            const changedIDs = newTasks
                .filter((nt) => {
                    const old = currentTasks.find((o) => o.id === nt.id);
                    return !old || old.text !== nt.text || old.completed !== nt.completed || old.dueDate !== nt.dueDate;
                })
                .map((t) => t.id);
            const transition = document.startViewTransition(() =>
                flushSync(() => dispatch({ type: 'REPLACE_ALL', tasks: newTasks })),
            );
            transition.finished.then(() => highlightItems(changedIDs));
        },
    });
};
