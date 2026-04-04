import {
    QueryClient,
    QueryClientProvider,
    useQuery,
} from '@tanstack/react-query';
import {useCallback, useEffect, useMemo, useState} from 'react';
import {decodeAllEmbeddings} from './lib/embeddings';
import {
    embedQuery,
    loadModel,
    searchProducts,
    type TFlatItem,
} from './lib/search';

type TRawCategory = {
    readonly id: string;
    readonly categoryTitle: string;
    readonly subcategories: readonly {
        readonly id: string;
        readonly subCategoryTitle: string;
        readonly items: readonly {
            readonly id: string;
            readonly title: string;
            readonly originalPrice: number;
            readonly currentPrice: number;
        }[];
    }[];
};

const SHUFFLE_SEED = 14;
const IMAGE_BASE = 'https://static.page-use.com/demos/grocery/images';
const DEBOUNCE_MS = 400;
const DATA_URL = 'https://static.page-use.com/demos/grocery/data.json';
const EMBEDDINGS_URL =
    'https://static.page-use.com/demos/grocery/embeddings-base64.json';

// --- Utility ---

const mulberry32 = (seed: number) => {
    let s = seed | 0;
    return () => {
        s = (s + 0x6d2b79f5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

const seededShuffle = <T,>(items: readonly T[], seed: number): readonly T[] => {
    const rng = mulberry32(seed);
    const arr = [...items];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
};

// --- Hooks ---

const useSearchParam = (
    key: string,
): readonly [string, (v: string) => void] => {
    const [value, setValue] = useState(
        () => new URLSearchParams(window.location.search).get(key) ?? '',
    );

    const setParam = useCallback(
        (v: string) => {
            const url = new URL(window.location.href);
            if (v) {
                url.searchParams.set(key, v);
            } else {
                url.searchParams.delete(key);
            }
            window.history.replaceState({}, '', url);
            setValue(v);
        },
        [key],
    );

    return [value, setParam] as const;
};

const useDebouncedValue = <T,>(value: T, delay: number): T => {
    const [debounced, setDebounced] = useState(value);

    useEffect(() => {
        const timer = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(timer);
    }, [value, delay]);

    return debounced;
};

// --- Data loaders ---

const flattenCategories = (
    categories: readonly TRawCategory[],
): readonly TFlatItem[] =>
    categories.flatMap((cat) =>
        cat.subcategories.flatMap((sub) =>
            sub.items.map((item) => ({
                id: item.id,
                name: item.title,
                categoryTitle: cat.categoryTitle,
                subcategoryTitle: sub.subCategoryTitle,
                originalPrice: item.originalPrice,
                currentPrice: item.currentPrice,
            })),
        ),
    );

const loadData = async (): Promise<readonly TFlatItem[]> => {
    const res = await fetch(DATA_URL);
    const categories: TRawCategory[] = await res.json();
    return flattenCategories(categories);
};

const loadEmbeddings = async (): Promise<ReadonlyMap<string, Float32Array>> => {
    const res = await fetch(EMBEDDINGS_URL);
    const raw: Record<string, string> = await res.json();
    return decodeAllEmbeddings(raw);
};

// --- App ---

const queryClient = new QueryClient();

const App = () => (
    <QueryClientProvider client={queryClient}>
        <Grocery />
    </QueryClientProvider>
);

const Grocery = () => {
    const [searchParam, setSearchParam] = useSearchParam('q');
    const [inputValue, setInputValue] = useState(searchParam);
    const debouncedInput = useDebouncedValue(inputValue, DEBOUNCE_MS);

    const {data: items} = useQuery({
        queryKey: ['data'],
        queryFn: loadData,
        staleTime: Infinity,
    });

    const {data: embeddings} = useQuery({
        queryKey: ['embeddings'],
        queryFn: loadEmbeddings,
        staleTime: Infinity,
    });

    useQuery({
        queryKey: ['model'],
        queryFn: loadModel,
        staleTime: Infinity,
    });

    const {data: results, isFetching: searching} = useQuery({
        queryKey: ['search', debouncedInput] as const,
        queryFn: () =>
            embedQuery(debouncedInput).then((vec) =>
                searchProducts(vec, items!, embeddings!),
            ),
        enabled: !!debouncedInput.trim() && !!items && !!embeddings,
        staleTime: Infinity,
    });

    const shuffledItems = useMemo(
        () => (items ? seededShuffle(items, SHUFFLE_SEED).slice(0, 50) : []),
        [items],
    );

    const dataReady = !!items && !!embeddings;
    const hasQuery = !!debouncedInput.trim();

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="mx-auto max-w-2xl">
                <h1 className="mb-6 text-2xl font-bold text-gray-900">
                    Grocery Semantic Search
                </h1>

                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        setSearchParam(inputValue);
                    }}
                    className="mb-6">
                    <input
                        type="text"
                        className="w-full rounded-lg border border-gray-300 px-4 py-3 text-lg shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                        placeholder={
                            dataReady
                                ? 'Search products semantically...'
                                : 'Loading data...'
                        }
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        disabled={!dataReady}
                    />
                    {searching && (
                        <p className="mt-2 text-sm text-gray-500">
                            Searching...
                        </p>
                    )}
                    {!dataReady && (
                        <p className="mt-2 text-sm text-gray-500">
                            Loading {!items ? 'products' : 'embeddings'}...
                        </p>
                    )}
                </form>

                {hasQuery && results && results.length > 0 && (
                    <div className="space-y-2">
                        {results.slice(0, 50).map((r, idx) => (
                            <div
                                key={r.item.id}
                                className={`flex items-center gap-3 rounded-lg border bg-white px-4 py-3 shadow-sm ${
                                    r.score < 0.5 ? 'opacity-40' : ''
                                }`}>
                                <img
                                    src={`${IMAGE_BASE}/${r.item.id}.jpeg`}
                                    alt={r.item.name}
                                    className="size-12 shrink-0 rounded-md object-cover"
                                />
                                <div className="min-w-0 flex-1">
                                    <span className="mr-2 font-mono text-xs text-gray-400">
                                        {idx + 1}.
                                    </span>
                                    <span className="font-medium text-gray-900">
                                        {r.item.name}
                                    </span>
                                    <p className="mt-0.5 text-xs text-gray-500">
                                        {r.item.categoryTitle} /{' '}
                                        {r.item.subcategoryTitle}
                                    </p>
                                </div>
                                <div className="ml-4 flex shrink-0 flex-col items-end">
                                    <span className="font-mono text-xs text-gray-400">
                                        {r.score.toFixed(4)}
                                    </span>
                                    <span className="text-sm font-medium text-gray-900">
                                        {r.item.originalPrice >
                                            r.item.currentPrice && (
                                            <span className="mr-1 text-gray-400 line-through">
                                                {r.item.originalPrice}
                                            </span>
                                        )}
                                        {r.item.currentPrice}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {!hasQuery && (
                    <div className="space-y-2">
                        {shuffledItems.map((item) => (
                            <div
                                key={item.id}
                                className="flex items-center gap-3 rounded-lg border bg-white px-4 py-3 shadow-sm">
                                <img
                                    src={`${IMAGE_BASE}/${item.id}.jpeg`}
                                    alt={item.name}
                                    className="size-12 shrink-0 rounded-md object-cover"
                                />
                                <div className="min-w-0 flex-1">
                                    <span className="font-medium text-gray-900">
                                        {item.name}
                                    </span>
                                    <p className="mt-0.5 text-xs text-gray-500">
                                        {item.categoryTitle} /{' '}
                                        {item.subcategoryTitle}
                                    </p>
                                </div>
                                <span className="ml-4 shrink-0 text-sm font-medium text-gray-900">
                                    {item.originalPrice > item.currentPrice && (
                                        <span className="mr-1 text-gray-400 line-through">
                                            {item.originalPrice}
                                        </span>
                                    )}
                                    {item.currentPrice}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default App;
