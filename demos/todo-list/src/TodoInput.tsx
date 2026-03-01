import { useState } from 'react';

const TodoInput = ({ onAdd }: { onAdd: (text: string, dueDate: string) => void }) => {
    const [text, setText] = useState('');
    const [dueDate, setDueDate] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = text.trim();
        if (!trimmed) return;
        onAdd(trimmed, dueDate);
        setText('');
        setDueDate('');
    };

    return (
        <form onSubmit={handleSubmit} className="flex gap-2">
            <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Add a task..."
                className="flex-1 rounded border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black"
            />
            <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="rounded border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black"
            />
            <button
                type="submit"
                className="rounded bg-black px-4 py-2 text-sm text-white transition-colors hover:bg-black/80"
            >
                Add
            </button>
        </form>
    );
};

export default TodoInput;
