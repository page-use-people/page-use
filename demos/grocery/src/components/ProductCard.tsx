import type {TFlatItem} from '../lib/search';
import {useCartStore, getQuantity} from '../store/cart';

type TProductCardProps = {
    readonly item: TFlatItem;
    readonly index?: number;
    readonly score?: number;
    readonly imageBase: string;
};

export const ProductCard = ({item, index, score, imageBase}: TProductCardProps) => {
    const quantity = useCartStore((s) => getQuantity(s, item.id));
    const addItem = useCartStore((s) => s.addItem);
    const incrementItem = useCartStore((s) => s.incrementItem);
    const decrementItem = useCartStore((s) => s.decrementItem);

    return (
        <div
            className={`flex items-center gap-3 rounded-lg border bg-white px-4 py-3 shadow-sm ${
                score !== undefined && score < 0.5 ? 'opacity-40' : ''
            }`}>
            <img
                src={`${imageBase}/${item.id}.jpeg`}
                alt={item.name}
                className="size-12 shrink-0 rounded-md object-cover"
            />
            <div className="min-w-0 flex-1">
                {index !== undefined && (
                    <span className="mr-2 font-mono text-xs text-gray-400">
                        {index + 1}.
                    </span>
                )}
                <span className="font-medium text-gray-900">
                    {item.name}
                </span>
                <p className="mt-0.5 text-xs text-gray-500">
                    {item.categoryTitle} / {item.subcategoryTitle}
                </p>
            </div>
            <div className="ml-4 flex shrink-0 flex-col items-end gap-1">
                {score !== undefined && (
                    <span className="font-mono text-xs text-gray-400">
                        {score.toFixed(4)}
                    </span>
                )}
                <span className="text-sm font-medium text-gray-900">
                    {item.originalPrice > item.currentPrice && (
                        <span className="mr-1 text-gray-400 line-through">
                            {item.originalPrice.toFixed(2)}
                        </span>
                    )}
                    {item.currentPrice.toFixed(2)}
                </span>
                {quantity === 0 ? (
                    <button
                        type="button"
                        onClick={() => addItem(item)}
                        className="rounded bg-blue-500 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-blue-600">
                        Add to Cart
                    </button>
                ) : (
                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={() => decrementItem(item.id)}
                            className="flex size-6 items-center justify-center rounded bg-gray-200 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-300">
                            −
                        </button>
                        <span className="min-w-[1.25rem] text-center text-sm font-medium text-gray-900">
                            {quantity}
                        </span>
                        <button
                            type="button"
                            onClick={() => incrementItem(item.id)}
                            className="flex size-6 items-center justify-center rounded bg-gray-200 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-300">
                            +
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
