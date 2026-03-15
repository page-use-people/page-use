import { useCallback, useEffect, useRef, useState } from 'react';

export function Task(props: { id: string; task: string; setHeight: (id: string, height: number) => void }) {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        props.setHeight(props.id, containerRef.current!.getBoundingClientRect().height);
    }, []);

    return <div ref={containerRef}>{props.task}</div>;
}

export function Next() {
    const [dragging, setDragging] = useState<string | null>(null);
    const [heights, setHeights] = useState<Record<string, number>>({});
    const [todos, setTodos] = useState<
        Array<{
            id: string;
            task: string;
            date: null | string;
        }>
    >([
        { id: 'a', task: 'Tomato', date: null },
        { id: 'b', task: 'Potato', date: null },
        { id: 'c', task: 'Mango', date: null },
    ]);

    const setHeight = useCallback(
        (id: string, height: number) => {
            setHeights((prevHeights) => ({ ...prevHeights, [id]: height }));
        },
        [setHeights],
    );

    return (
        <div>
            {todos.map((todo) => (
                <Task id={todo.id} task={todo.task} setHeight={setHeight} />
            ))}
        </div>
    );
}
