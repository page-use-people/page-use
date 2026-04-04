export type TFauxCursorMode = 'browse' | 'search' | 'cart';

export type TAgentAction = {
    readonly mode: TFauxCursorMode;
    readonly label: string;
};
