export type TTask = {
    readonly id: string;
    readonly text: string;
    readonly dueDate: string;
    readonly completed: boolean;
};

export type TAction =
    | { readonly type: 'ADD_TASK'; readonly id: string; readonly text: string; readonly dueDate: string }
    | { readonly type: 'DELETE_TASK'; readonly id: string }
    | { readonly type: 'TOGGLE_TASK'; readonly id: string }
    | { readonly type: 'UPDATE_TASK'; readonly id: string; readonly text: string; readonly dueDate: string }
    | { readonly type: 'DRAG_OVER'; readonly activeID: string; readonly overID: string }
    | { readonly type: 'DRAG_REORDER'; readonly activeID: string; readonly overID: string }
    | { readonly type: 'REPLACE_ALL'; readonly tasks: ReadonlyArray<TTask> };
