import { useReducer, useEffect, useMemo } from 'react';
import { DndContext, closestCorners, DragOverlay } from '@dnd-kit/core';
import { SystemPrompt } from '@page-use/react';
import { PageUseChat } from '@page-use/react/ui/chat';
import { taskReducer, splitByCompletion } from './state/reducer.ts';
import { loadTasks, saveTasks } from './state/persistence.ts';
import { useHighlight } from './hooks/use-highlight.ts';
import { useFocusManagement } from './hooks/use-focus-management.ts';
import { useTaskAgent } from './hooks/use-task-agent.ts';
import { useDragReorder } from './hooks/use-drag-reorder.ts';
import TaskCard from './components/TaskCard.tsx';
import TaskSection from './components/TaskSection.tsx';
import DragPreview from './components/DragPreview.tsx';

const App = () => {
    const [tasks, dispatch] = useReducer(taskReducer, undefined, loadTasks);

    const { highlightedIDs, highlightItems } = useHighlight();
    const { newItemID, setNewItemID, registerRef, focusTask } = useFocusManagement();

    useTaskAgent(tasks, dispatch, highlightItems);
    const { activeID, sensors, onDragStart, onDragOver, onDragEnd } = useDragReorder(dispatch, highlightItems);

    const { incomplete, completed } = useMemo(() => splitByCompletion(tasks), [tasks]);

    useEffect(() => {
        saveTasks(tasks);
    }, [tasks]);

    const activeTask = activeID ? tasks.find((t) => t.id === activeID) : undefined;

    return (
        <>
            <SystemPrompt>
                {`
                    You are a helpful todo list assistant.

                    For Context:
                    - You help me manage my tasks in a todo list app.
                    - The app has two sections: "To Do" (incomplete) and "Completed"
                    - Each item has a text description, an optional due date, and a completion status.
                    - Items can be dragged between sections, but you manage them via functions.
                    - You can add new todos, delete existing ones, toggle their completion status, and clear all items.
                `}
            </SystemPrompt>

            <div className="min-h-screen text-stone-800 px-4 py-8 mb-32">
                <h1 className={'mx-auto max-w-md text-5xl text-center font-light text-pink-600'}>Todo List 🤝 Agent</h1>
                <div className="mx-auto max-w-md">
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCorners}
                        onDragStart={onDragStart}
                        onDragOver={onDragOver}
                        onDragEnd={onDragEnd}>
                        <TaskSection id="incomplete" title="TO DO" itemIDs={incomplete.map((t) => t.id)} isEmpty={incomplete.length === 0}>
                            {incomplete.map((task, idx) => (
                                <TaskCard
                                    key={task.id}
                                    item={task}
                                    autoFocus={task.id === newItemID}
                                    highlighted={highlightedIDs.has(task.id)}
                                    textareaRef={registerRef(task.id)}
                                    onToggle={() => {
                                        dispatch({ type: 'TOGGLE_TASK', id: task.id });
                                        highlightItems([task.id]);
                                    }}
                                    onDelete={() => dispatch({ type: 'DELETE_TASK', id: task.id })}
                                    onUpdate={(text, dueDate) =>
                                        dispatch({ type: 'UPDATE_TASK', id: task.id, text, dueDate })
                                    }
                                    onAddBelow={() => {
                                        const id = crypto.randomUUID();
                                        setNewItemID(id);
                                        dispatch({ type: 'ADD_TASK', id, text: '', dueDate: '' });
                                    }}
                                    onDeleteFocusPrev={() => {
                                        const prevTask = incomplete[idx - 1];
                                        dispatch({ type: 'DELETE_TASK', id: task.id });
                                        if (prevTask) {
                                            focusTask(prevTask.id);
                                        }
                                    }}
                                />
                            ))}
                        </TaskSection>
                        <div className="text-center py-2 px-8">
                            <button
                                onClick={() => {
                                    const id = crypto.randomUUID();
                                    setNewItemID(id);
                                    dispatch({ type: 'ADD_TASK', id, text: '', dueDate: '' });
                                }}
                                className="mt-2 flex items-center gap-1 text-sm text-stone-600/60 transition-colors hover:text-stone-800">
                                + Add Task
                            </button>
                        </div>
                        <TaskSection id="completed" title="Done" itemIDs={completed.map((t) => t.id)} isEmpty={completed.length === 0}>
                            {completed.map((task) => (
                                <TaskCard
                                    key={task.id}
                                    item={task}
                                    highlighted={highlightedIDs.has(task.id)}
                                    onToggle={() => {
                                        dispatch({ type: 'TOGGLE_TASK', id: task.id });
                                        highlightItems([task.id]);
                                    }}
                                    onDelete={() => dispatch({ type: 'DELETE_TASK', id: task.id })}
                                    onUpdate={(text, dueDate) =>
                                        dispatch({ type: 'UPDATE_TASK', id: task.id, text, dueDate })
                                    }
                                    onAddBelow={() => {
                                        const id = crypto.randomUUID();
                                        setNewItemID(id);
                                        dispatch({ type: 'ADD_TASK', id, text: '', dueDate: '' });
                                    }}
                                />
                            ))}
                        </TaskSection>
                        <DragOverlay>
                            <DragPreview task={activeTask} />
                        </DragOverlay>
                    </DndContext>
                </div>
            </div>

            <PageUseChat
                title={'Task Master'}
                greeting={`Hi, I'm the _Task Master_. I help you manage your todo list.`}
                theme="dark"
                placeholder={'Write to Task Master'}
                roundedness={'sm'}
                icon={({ location }) => <span className={location === 'launcher' ? 'text-3xl' : 'text-xl'}>🐼</span>}
                cssVariables={{
                    '--pu-bg': '#292217',
                    '--pu-fg': '#eae7d6',
                    '--pu-surface': '#423c2c',
                    '--pu-muted': '#776d55',
                    '--pu-divider': '#433425',
                    '--pu-accent': '#af9055',
                    '--pu-shadow': '0 25px 60px rgba(6,4,0,0.65)',
                }}
                devMode
            />
        </>
    );
};

export default App;
