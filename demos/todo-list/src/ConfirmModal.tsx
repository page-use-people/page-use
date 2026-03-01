import { useEffect, useRef } from 'react';

const ConfirmModal = ({
    open,
    message,
    onConfirm,
    onCancel,
}: {
    open: boolean;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
}) => {
    const ref = useRef<HTMLDialogElement>(null);

    useEffect(() => {
        const dialog = ref.current;
        if (!dialog) return;
        if (open && !dialog.open) {
            dialog.showModal();
        } else if (!open && dialog.open) {
            dialog.close();
        }
    }, [open]);

    return (
        <dialog
            ref={ref}
            onClose={onCancel}
            className="m-auto rounded-lg border border-gray-200 p-6 shadow-lg backdrop:bg-black/50"
        >
            <p className="mb-4 text-sm">{message}</p>
            <div className="flex justify-end gap-2">
                <button
                    onClick={onCancel}
                    className="rounded border border-gray-300 px-4 py-2 text-sm transition-colors hover:bg-gray-100"
                >
                    Cancel
                </button>
                <button
                    onClick={onConfirm}
                    className="rounded bg-black px-4 py-2 text-sm text-white transition-colors hover:bg-black/80"
                >
                    Clear All
                </button>
            </div>
        </dialog>
    );
};

export default ConfirmModal;
