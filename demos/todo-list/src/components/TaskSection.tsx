import clsx from 'clsx';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

const TaskSection = ({
    id,
    title,
    itemIDs,
    children,
    isEmpty,
}: {
    readonly id: string;
    readonly title: string;
    readonly itemIDs: ReadonlyArray<string>;
    readonly children: React.ReactNode;
    readonly isEmpty: boolean;
}) => {
    const { setNodeRef, isOver } = useDroppable({ id });
    return (
        <div className="mt-6">
            <h2 className="mb-2 text-sm uppercase tracking-wide text-stone-700/60">{title}</h2>
            <div
                ref={setNodeRef}
                className={clsx(
                    'min-h-[48px] border-dashed transition-colors',
                    isOver ? 'border-amber-400/30 bg-amber-100/30' : 'border-transparent',
                )}>
                {isEmpty ? (
                    <p className="py-3 text-sm text-amber-400/50">Time to get doing.</p>
                ) : (
                    <SortableContext items={itemIDs as string[]} strategy={verticalListSortingStrategy}>
                        <div className="space-y-2">{children}</div>
                    </SortableContext>
                )}
            </div>
        </div>
    );
};

export default TaskSection;
