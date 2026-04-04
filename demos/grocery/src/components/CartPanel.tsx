import {useShallow} from 'zustand/react/shallow';
import {
    useCartStore,
    getCartEntries,
    getGrandTotal,
    getIsEmpty,
} from '../store/cart';

type TCartPanelProps = {
    readonly imageBase: string;
};

export const CartPanel = ({imageBase}: TCartPanelProps) => {
    const entries = useCartStore(useShallow(getCartEntries));
    const grandTotal = useCartStore(getGrandTotal);
    const isEmpty = useCartStore(getIsEmpty);
    const incrementItem = useCartStore((s) => s.incrementItem);
    const decrementItem = useCartStore((s) => s.decrementItem);
    const removeItem = useCartStore((s) => s.removeItem);

    return (
        <aside className="sticky top-8 w-80 shrink-0">
            <div className="flex max-h-[calc(100vh-4rem)] flex-col rounded-lg border bg-white shadow-sm">
                <h2 className="shrink-0 border-b px-4 py-3 text-lg font-bold text-gray-900">
                    Cart
                </h2>

                <div className="flex-1 overflow-y-auto">
                    {isEmpty ? (
                        <p className="px-4 py-8 text-center text-sm text-gray-400">
                            Your cart is empty
                        </p>
                    ) : (
                        <div className="divide-y">
                            {entries.map((entry) => (
                                <div
                                    key={entry.item.id}
                                    className="flex items-start gap-3 px-4 py-3">
                                    <img
                                        src={`${imageBase}/${entry.item.id}.jpeg`}
                                        alt={entry.item.name}
                                        className="size-10 shrink-0 rounded-md object-cover"
                                    />
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-medium text-gray-900">
                                            {entry.item.name}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            {entry.item.currentPrice.toFixed(2)}{' '}
                                            per unit
                                        </p>
                                        <p className="text-sm font-medium text-gray-900">
                                            {(
                                                entry.item.currentPrice *
                                                entry.quantity
                                            ).toFixed(2)}
                                        </p>
                                        <div className="mt-1.5 flex items-center gap-1.5">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    decrementItem(
                                                        entry.item.id,
                                                    )
                                                }
                                                className="flex size-6 items-center justify-center rounded bg-gray-200 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-300">
                                                −
                                            </button>
                                            <span className="min-w-[1.25rem] text-center text-sm font-medium text-gray-900">
                                                {entry.quantity}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    incrementItem(
                                                        entry.item.id,
                                                    )
                                                }
                                                className="flex size-6 items-center justify-center rounded bg-gray-200 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-300">
                                                +
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    removeItem(entry.item.id)
                                                }
                                                className="ml-2 text-xs text-red-500 transition-colors hover:text-red-700">
                                                Remove
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="shrink-0 border-t px-4 py-3">
                    <div className="mb-3 flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-600">
                            Grand Total
                        </span>
                        <span className="text-lg font-bold text-gray-900">
                            {grandTotal.toFixed(2)}
                        </span>
                    </div>
                    <button
                        type="button"
                        disabled={isEmpty}
                        className="w-full rounded-lg bg-blue-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500">
                        Place Order
                    </button>
                </div>
            </div>
        </aside>
    );
};
