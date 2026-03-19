import {makeAutoObservable} from 'mobx';

type TUIStoreConfig = {
    readonly initiallyExpanded: boolean;
};

export const createUIStore = ({initiallyExpanded}: TUIStoreConfig) =>
    makeAutoObservable({
        isPanelExpanded: initiallyExpanded,
        composerText: '',
        composerSelectionStart: 0,
        composerSelectionEnd: 0,

        expandPanel(
            draft?: string,
            selectionStart?: number,
            selectionEnd?: number,
        ) {
            this.isPanelExpanded = true;
            if (draft !== undefined) {
                this.composerText = draft;
                this.composerSelectionStart = selectionStart ?? draft.length;
                this.composerSelectionEnd = selectionEnd ?? draft.length;
            }
        },

        collapsePanel(
            text: string,
            selectionStart: number,
            selectionEnd: number,
        ) {
            this.isPanelExpanded = false;
            this.composerText = text;
            this.composerSelectionStart = selectionStart;
            this.composerSelectionEnd = selectionEnd;
        },

        updateComposerText(text: string) {
            this.composerText = text;
        },

        updateComposerSelection(start: number, end: number) {
            this.composerSelectionStart = start;
            this.composerSelectionEnd = end;
        },

        clearComposerText() {
            this.composerText = '';
            this.composerSelectionStart = 0;
            this.composerSelectionEnd = 0;
        },
    });

export type TUIStore = ReturnType<typeof createUIStore>;
