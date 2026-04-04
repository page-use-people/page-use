import { useState, useRef, useCallback } from 'react';

export const useFocusManagement = () => {
    const textareaRefs = useRef<Map<string, HTMLTextAreaElement>>(new Map());
    const [newItemID, setNewItemID] = useState<string | null>(null);

    const registerRef = useCallback(
        (id: string) => (el: HTMLTextAreaElement | null) => {
            if (el) {
                textareaRefs.current.set(id, el);
            } else {
                textareaRefs.current.delete(id);
            }
        },
        [],
    );

    const focusTask = useCallback((id: string) => {
        setTimeout(() => {
            const ta = textareaRefs.current.get(id);
            if (ta) {
                ta.focus();
                ta.setSelectionRange(ta.value.length, ta.value.length);
            }
        }, 0);
    }, []);

    return { newItemID, setNewItemID, registerRef, focusTask } as const;
};
