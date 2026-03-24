import {
    startTransition,
    useDeferredValue,
    useEffect,
    useMemo,
    useRef,
    useState,
    type CSSProperties,
} from 'react';
import {PageUseChat} from '@page-use/react/ui/chat';
import {SystemPrompt, useAgentFunction, useAgentVariable, z} from '@page-use/react';
import {CartPanel, type TCartLine} from './components/CartPanel.tsx';
import {FauxCursor} from './components/FauxCursor.tsx';
import {ProductCard} from './components/ProductCard.tsx';
import {
    formatPrice,
    normalizeCatalog,
    wait,
    type TCatalogData,
    type TCatalogProduct,
    type TRawProductsPayload,
} from './lib/catalog.ts';

type TVisibleProductCard = {
    readonly id: number;
    readonly title: string;
    readonly subtitle: string;
    readonly price: number | null;
    readonly category: string | null;
    readonly accent: string;
};

type TFeaturedCategory = {
    readonly key: string;
    readonly label: string;
    readonly count: number;
};

type TCartSummary = {
    readonly totalItems: number;
    readonly subtotal: number | null;
    readonly lines: readonly TCartLine[];
};

type TAnimateSearchResult = {
    readonly resultCount: number;
    readonly leadingResultId: number | null;
    readonly leadingResultTitle: string | null;
};

type TCategoryResult = {
    readonly selectedCategory: string | null;
    readonly productCount: number;
};

type TSpotlightResult = {
    readonly productId: number;
    readonly productTitle: string;
};

type TCartResult = {
    readonly totalItems: number;
    readonly subtotal: number | null;
};

type TCartDrawerResult = {
    readonly isOpen: boolean;
    readonly totalItems: number;
};

type TCatalogWindow = {
    readonly visibleFrom: number;
    readonly visibleTo: number;
    readonly visibleCount: number;
    readonly totalMatches: number;
    readonly canScrollNext: boolean;
    readonly canScrollPrevious: boolean;
};

type TFauxCursorMode = 'browse' | 'search' | 'cart';

const MAX_VISIBLE_PRODUCTS = 24;
const MAX_AGENT_VISIBLE_PRODUCTS = MAX_VISIBLE_PRODUCTS;
const SEARCH_TYPING_BASE_MS = 28;

const visibleProductCardSchema = z.object({
    id: z.number().describe('catalog product id and image id'),
    title: z.string().describe('product title'),
    subtitle: z.string().describe('unit or subtitle'),
    price: z.number().nullable().describe('price in BDT when known'),
    category: z.string().nullable().describe('primary category label if present'),
    accent: z.string().describe('accent color used in the cart or modal'),
});

const featuredCategorySchema = z.object({
    key: z.string().describe('category key'),
    label: z.string().describe('human-friendly category label'),
    count: z.number().describe('number of products in the category'),
});

const cartSummaryLineSchema = z.object({
    productId: z.number().describe('product id'),
    title: z.string().describe('product title'),
    quantity: z.number().describe('quantity in cart'),
    price: z.number().nullable().describe('single-unit price when known'),
    lineTotal: z.number().nullable().describe('line total when all prices are known'),
    accent: z.string().describe('accent color used for cart styling'),
});

const cartSummarySchema = z.object({
    totalItems: z.number().describe('total quantity across the basket'),
    subtotal: z.number().nullable().describe('basket subtotal in BDT when all prices are known'),
    lines: z.array(cartSummaryLineSchema).describe('current basket lines'),
});

const nullableSpotlightSchema = visibleProductCardSchema
    .extend({
        imageUrl: z.string().describe('cdn image url for the open product modal'),
    })
    .nullable();

const animateSearchInputSchema = z.object({
    query: z.string().describe('search query to fake type into the storefront search box'),
    categoryKey: z.string().nullable().optional().describe('optional category key to select before searching'),
});

const animateSearchOutputSchema = z.object({
    resultCount: z.number().describe('number of matching products'),
    leadingResultId: z.number().nullable().describe('first matching product id if any'),
    leadingResultTitle: z.string().nullable().describe('first matching product title if any'),
});

const categorySelectionSchema = z.object({
    categoryKey: z.string().nullable().describe('category key to browse, or null to clear category filtering'),
});

const categorySelectionOutputSchema = z.object({
    selectedCategory: z.string().nullable().describe('resulting category key'),
    productCount: z.number().describe('count of matching products under the current filters'),
});

const spotlightInputSchema = z.object({
    productId: z.number().describe('product id to open in the product modal'),
});

const spotlightOutputSchema = z.object({
    productId: z.number().describe('opened product id'),
    productTitle: z.string().describe('opened product title'),
});

const cartInputSchema = z.object({
    productId: z.number().describe('product id to add or remove'),
    quantityDelta: z.number().describe('positive to add, negative to remove'),
});

const cartOutputSchema = z.object({
    totalItems: z.number().describe('total quantity after mutation'),
    subtotal: z.number().nullable().describe('basket subtotal in BDT when all prices are known'),
});

const cartDrawerInputSchema = z.object({
    open: z
        .boolean()
        .describe('whether the floating cart drawer should be open'),
});

const cartDrawerOutputSchema = z.object({
    isOpen: z.boolean().describe('current open state of the cart drawer'),
    totalItems: z.number().describe('current total quantity in the cart'),
});

const catalogWindowSchema = z.object({
    visibleFrom: z.number().describe('1-based index of the first visible product in the filtered list'),
    visibleTo: z.number().describe('1-based index of the last visible product in the filtered list'),
    visibleCount: z.number().describe('count of currently visible products'),
    totalMatches: z.number().describe('total products matching the current search and category'),
    canScrollNext: z.boolean().describe('whether more matching products exist after the current window'),
    canScrollPrevious: z.boolean().describe('whether earlier matching products exist before the current window'),
});

const scrollCatalogInputSchema = z.object({
    direction: z
        .enum(['next', 'previous'])
        .describe('which direction to move through the filtered product window'),
    pages: z
        .number()
        .int()
        .min(1)
        .max(6)
        .optional()
        .describe('how many product windows to move at once'),
});

const nextFrame = (signal?: AbortSignal) =>
    new Promise<void>((resolve, reject) => {
        if (signal?.aborted) {
            reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
            return;
        }

        const frame = window.requestAnimationFrame(() => {
            signal?.removeEventListener('abort', onAbort);
            resolve();
        });

        const onAbort = () => {
            window.cancelAnimationFrame(frame);
            reject(signal?.reason ?? new DOMException('Aborted', 'AbortError'));
        };

        signal?.addEventListener('abort', onAbort, {once: true});
    });

const easeInOutCubic = (value: number) =>
    value < 0.5 ? 4 * value * value * value : 1 - ((-2 * value + 2) ** 3) / 2;

const matchesFilters = (
    product: TCatalogProduct,
    selectedCategory: string | null,
    query: string,
) => {
    const matchesCategory =
        selectedCategory === null || product.categoryKeys.includes(selectedCategory);
    const matchesSearch =
        query.length === 0 || product.searchText.includes(query.toLowerCase());
    return matchesCategory && matchesSearch;
};

const getFilteredProducts = (
    catalog: TCatalogData | null,
    selectedCategory: string | null,
    query: string,
) => {
    if (!catalog) {
        return [];
    }

    const normalizedQuery = query.trim().toLowerCase();
    return catalog.products.filter((product) =>
        matchesFilters(product, selectedCategory, normalizedQuery),
    );
};

const clampWindowStart = (start: number, totalMatches: number) =>
    Math.max(0, Math.min(start, Math.max(0, totalMatches - MAX_VISIBLE_PRODUCTS)));

const buildCatalogWindow = (
    products: readonly TCatalogProduct[],
    start: number,
): TCatalogWindow => {
    if (products.length === 0) {
        return {
            visibleFrom: 0,
            visibleTo: 0,
            visibleCount: 0,
            totalMatches: 0,
            canScrollNext: false,
            canScrollPrevious: false,
        };
    }

    const clampedStart = clampWindowStart(start, products.length);
    const visibleFrom = clampedStart + 1;
    const visibleTo = Math.min(products.length, clampedStart + MAX_VISIBLE_PRODUCTS);

    return {
        visibleFrom,
        visibleTo,
        visibleCount: visibleTo - visibleFrom + 1,
        totalMatches: products.length,
        canScrollNext: visibleTo < products.length,
        canScrollPrevious: clampedStart > 0,
    };
};

const loadCatalog = async (): Promise<TCatalogData> => {
    const [productsResponse, palettesResponse] = await Promise.all([
        fetch('/data/products.json'),
        fetch('/data/image-palettes.json'),
    ]);

    if (!productsResponse.ok || !palettesResponse.ok) {
        throw new Error('Failed to load local grocery demo data.');
    }

    const [productsPayload, palettes] = await Promise.all([
        productsResponse.json() as Promise<TRawProductsPayload>,
        palettesResponse.json() as Promise<
            readonly (readonly (string | null)[])[]
        >,
    ]);

    return normalizeCatalog(productsPayload, palettes);
};

const App = () => {
    const [catalog, setCatalog] = useState<TCatalogData | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [searchText, setSearchText] = useState('');
    const [modalProductId, setModalProductId] = useState<number | null>(null);
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [visibleStartIndex, setVisibleStartIndex] = useState(0);
    const [cartQuantities, setCartQuantities] = useState<Record<number, number>>({});
    const [cartIsPulsing, setCartIsPulsing] = useState(false);
    const [searchIsAnimating, setSearchIsAnimating] = useState(false);
    const [highlightedProductId, setHighlightedProductId] = useState<number | null>(
        null,
    );

    const deferredSearchText = useDeferredValue(searchText);
    const selectedCategoryRef = useRef<string | null>(selectedCategory);
    const searchTextRef = useRef(searchText);
    const visibleStartIndexRef = useRef(visibleStartIndex);
    const modalProductIdRef = useRef<number | null>(modalProductId);
    const isCartOpenRef = useRef(isCartOpen);
    const cartQuantitiesRef = useRef(cartQuantities);
    const highlightTimerRef = useRef<number | null>(null);
    const cartPulseTimerRef = useRef<number | null>(null);

    const searchInputRef = useRef<HTMLInputElement | null>(null);
    const allCategoryButtonRef = useRef<HTMLButtonElement | null>(null);
    const categoryButtonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
    const productCardRefs = useRef<Map<number, HTMLElement>>(new Map());
    const gridSectionRef = useRef<HTMLElement | null>(null);
    const previousWindowButtonRef = useRef<HTMLButtonElement | null>(null);
    const nextWindowButtonRef = useRef<HTMLButtonElement | null>(null);
    const cartFabButtonRef = useRef<HTMLButtonElement | null>(null);
    const modalCloseButtonRef = useRef<HTMLButtonElement | null>(null);
    const modalAddButtonRef = useRef<HTMLButtonElement | null>(null);
    const cursorRef = useRef<HTMLDivElement | null>(null);
    const cursorLabelRef = useRef<HTMLDivElement | null>(null);
    const cursorPositionRef = useRef({x: 96, y: 96});

    useEffect(() => {
        selectedCategoryRef.current = selectedCategory;
    }, [selectedCategory]);

    useEffect(() => {
        searchTextRef.current = searchText;
    }, [searchText]);

    useEffect(() => {
        visibleStartIndexRef.current = visibleStartIndex;
    }, [visibleStartIndex]);

    useEffect(() => {
        modalProductIdRef.current = modalProductId;
    }, [modalProductId]);

    useEffect(() => {
        isCartOpenRef.current = isCartOpen;
    }, [isCartOpen]);

    useEffect(() => {
        cartQuantitiesRef.current = cartQuantities;
    }, [cartQuantities]);

    useEffect(() => {
        void loadCatalog()
            .then((nextCatalog) => {
                setCatalog(nextCatalog);
            })
            .catch((error) => {
                setLoadError(error instanceof Error ? error.message : String(error));
            });
    }, []);

    useEffect(
        () => () => {
            if (highlightTimerRef.current !== null) {
                window.clearTimeout(highlightTimerRef.current);
            }
            if (cartPulseTimerRef.current !== null) {
                window.clearTimeout(cartPulseTimerRef.current);
            }
        },
        [],
    );

    useEffect(() => {
        const cursor = cursorRef.current;
        if (!cursor) {
            return;
        }

        cursor.style.opacity = '0';
        cursor.style.transform = `translate(${cursorPositionRef.current.x}px, ${cursorPositionRef.current.y}px)`;
    }, []);

    useEffect(() => {
        if (modalProductId === null) {
            return;
        }

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                modalProductIdRef.current = null;
                setModalProductId(null);
            }
        };

        window.addEventListener('keydown', onKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [modalProductId]);

    const featuredCategories = useMemo<readonly TFeaturedCategory[]>(
        () =>
            (catalog?.categories ?? []).slice(0, 10).map((category) => ({
                key: category.key,
                label: category.label,
                count: category.count,
            })),
        [catalog],
    );

    const filteredProducts = useMemo(
        () => getFilteredProducts(catalog, selectedCategory, deferredSearchText),
        [catalog, deferredSearchText, selectedCategory],
    );

    useEffect(() => {
        startTransition(() => {
            setVisibleStartIndex(0);
        });
    }, [selectedCategory, searchText]);

    useEffect(() => {
        const maxStart = clampWindowStart(visibleStartIndex, filteredProducts.length);
        if (maxStart !== visibleStartIndex) {
            startTransition(() => {
                setVisibleStartIndex(maxStart);
            });
        }
    }, [filteredProducts.length, visibleStartIndex]);

    const visibleProducts = useMemo(
        () =>
            filteredProducts.slice(
                visibleStartIndex,
                visibleStartIndex + MAX_VISIBLE_PRODUCTS,
            ),
        [filteredProducts, visibleStartIndex],
    );

    const catalogWindow = useMemo(
        () => buildCatalogWindow(filteredProducts, visibleStartIndex),
        [filteredProducts, visibleStartIndex],
    );

    const modalProduct = useMemo(() => {
        if (!catalog || modalProductId === null) {
            return null;
        }

        return catalog.productMap.get(modalProductId) ?? null;
    }, [catalog, modalProductId]);

    const cartLines = useMemo<readonly TCartLine[]>(() => {
        if (!catalog) {
            return [];
        }

        return Object.entries(cartQuantities)
            .map(([productIdKey, quantity]) => {
                const productId = Number(productIdKey);
                const product = catalog.productMap.get(productId);
                if (!product || quantity <= 0) {
                    return null;
                }

                return {
                    productId,
                    title: product.title,
                    quantity,
                    price: product.price,
                    lineTotal:
                        product.price === null ? null : product.price * quantity,
                    accent: product.theme.accent,
                    shell: product.theme.shell,
                    imageUrl: product.imageUrl,
                } satisfies TCartLine;
            })
            .filter((line): line is TCartLine => line !== null)
            .sort((left, right) => left.productId - right.productId);
    }, [catalog, cartQuantities]);

    const cartSummary = useMemo<TCartSummary>(() => {
        const totalItems = cartLines.reduce(
            (sum, line) => sum + line.quantity,
            0,
        );
        const subtotal = cartLines.some((line) => line.lineTotal === null)
            ? null
            : cartLines.reduce((sum, line) => sum + (line.lineTotal ?? 0), 0);

        return {
            totalItems,
            subtotal,
            lines: cartLines,
        };
    }, [cartLines]);

    const visibleAgentCards = useMemo<readonly TVisibleProductCard[]>(
        () =>
            visibleProducts.slice(0, MAX_AGENT_VISIBLE_PRODUCTS).map((product) => ({
                id: product.id,
                title: product.title,
                subtitle: product.subtitle,
                price: product.price,
                category: product.primaryCategoryLabel,
                accent: product.theme.accent,
            })),
        [visibleProducts],
    );

    const modalAgentCard = modalProduct
        ? {
              id: modalProduct.id,
              title: modalProduct.title,
              subtitle: modalProduct.subtitle,
              price: modalProduct.price,
              category: modalProduct.primaryCategoryLabel,
              accent: modalProduct.theme.accent,
              imageUrl: modalProduct.imageUrl,
          }
        : null;

    const selectedCategoryLabel = selectedCategory
        ? catalog?.categoryMap.get(selectedCategory)?.label ?? 'Selected aisle'
        : 'All aisles';

    const modalStyle = modalProduct
        ? ({
              '--modal-accent': modalProduct.theme.accent,
              '--modal-support': modalProduct.theme.support,
              '--modal-deep': modalProduct.theme.deep,
              '--modal-soft': modalProduct.theme.soft,
              '--modal-shell': modalProduct.theme.shell,
              '--modal-glow': modalProduct.theme.glow,
              '--modal-foreground-accent': modalProduct.theme.foregroundOnAccent,
              '--modal-foreground-soft': modalProduct.theme.foregroundOnSoft,
          } as CSSProperties)
        : undefined;

    const openProductModal = (productId: number) => {
        setIsCartOpen(false);
        modalProductIdRef.current = productId;
        setModalProductId(productId);
        flashProduct(productId);
    };

    const flashProduct = (productId: number) => {
        if (highlightTimerRef.current !== null) {
            window.clearTimeout(highlightTimerRef.current);
        }

        setHighlightedProductId(productId);
        highlightTimerRef.current = window.setTimeout(() => {
            setHighlightedProductId(null);
            highlightTimerRef.current = null;
        }, 1100);
    };

    const pulseCartFab = () => {
        if (cartPulseTimerRef.current !== null) {
            window.clearTimeout(cartPulseTimerRef.current);
        }

        setCartIsPulsing(true);
        cartPulseTimerRef.current = window.setTimeout(() => {
            setCartIsPulsing(false);
            cartPulseTimerRef.current = null;
        }, 520);
    };

    const setCursorMode = (mode: TFauxCursorMode, label: string) => {
        const cursor = cursorRef.current;
        const labelNode = cursorLabelRef.current;
        if (!cursor || !labelNode) {
            return;
        }

        cursor.dataset.mode = mode;
        cursor.style.opacity = '1';
        labelNode.textContent = label;
    };

    const hideCursor = () => {
        const cursor = cursorRef.current;
        const labelNode = cursorLabelRef.current;
        if (!cursor || !labelNode) {
            return;
        }

        cursor.style.opacity = '0';
        labelNode.textContent = '';
    };

    const setCursorPosition = (x: number, y: number) => {
        cursorPositionRef.current = {x, y};
        const cursor = cursorRef.current;
        if (!cursor) {
            return;
        }

        cursor.style.transform = `translate(${x}px, ${y}px)`;
    };

    const animateCursorToPoint = async (
        targetX: number,
        targetY: number,
        signal?: AbortSignal,
        duration = 420,
    ) => {
        if (signal?.aborted) {
            throw signal.reason ?? new DOMException('Aborted', 'AbortError');
        }

        const start = cursorPositionRef.current;
        await new Promise<void>((resolve, reject) => {
            let frame = 0;
            const startedAt = performance.now();

            const onAbort = () => {
                window.cancelAnimationFrame(frame);
                reject(signal?.reason ?? new DOMException('Aborted', 'AbortError'));
            };

            const step = (timestamp: number) => {
                const elapsed = Math.min((timestamp - startedAt) / duration, 1);
                const eased = easeInOutCubic(elapsed);
                setCursorPosition(
                    start.x + (targetX - start.x) * eased,
                    start.y + (targetY - start.y) * eased,
                );

                if (elapsed < 1) {
                    frame = window.requestAnimationFrame(step);
                } else {
                    signal?.removeEventListener('abort', onAbort);
                    resolve();
                }
            };

            signal?.addEventListener('abort', onAbort, {once: true});
            frame = window.requestAnimationFrame(step);
        });
    };

    const pulseCursor = async (signal?: AbortSignal) => {
        const cursor = cursorRef.current;
        if (!cursor) {
            return;
        }

        cursor.dataset.clicking = 'true';
        await wait(120, signal);
        cursor.dataset.clicking = 'false';
    };

    const moveCursorToElement = async (
        element: Element | null,
        signal?: AbortSignal,
        duration = 420,
    ) => {
        if (!element) {
            return;
        }

        const rect = element.getBoundingClientRect();
        await animateCursorToPoint(
            rect.left + rect.width / 2,
            rect.top + rect.height / 2,
            signal,
            duration,
        );
    };

    const scrollCatalogWindow = async (
        direction: 'next' | 'previous',
        pages = 1,
        signal?: AbortSignal,
    ): Promise<TCatalogWindow> => {
        const currentFiltered = getFilteredProducts(
            catalog,
            selectedCategoryRef.current,
            searchTextRef.current,
        );
        let currentStart = visibleStartIndexRef.current;
        const stepCount = Math.max(1, pages);

        for (let page = 0; page < stepCount; page += 1) {
            const nextStart = clampWindowStart(
                currentStart +
                    (direction === 'next'
                        ? MAX_VISIBLE_PRODUCTS
                        : -MAX_VISIBLE_PRODUCTS),
                currentFiltered.length,
            );

            if (nextStart === currentStart) {
                break;
            }

            const button =
                direction === 'next'
                    ? nextWindowButtonRef.current
                    : previousWindowButtonRef.current;

            setCursorMode(
                'browse',
                direction === 'next' ? 'scroll forward' : 'scroll back',
            );
            await moveCursorToElement(button ?? gridSectionRef.current, signal, 340);
            await pulseCursor(signal);

            currentStart = nextStart;
            visibleStartIndexRef.current = nextStart;

            startTransition(() => {
                setVisibleStartIndex(nextStart);
            });

            await nextFrame(signal);
            gridSectionRef.current?.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
                inline: 'nearest',
            });
            await wait(180, signal);
        }

        hideCursor();

        return buildCatalogWindow(currentFiltered, currentStart);
    };

    const applyCategorySelection = async (
        categoryKey: string | null,
        signal?: AbortSignal,
    ): Promise<TCategoryResult> => {
        const nextCount = getFilteredProducts(
            catalog,
            categoryKey,
            searchTextRef.current,
        ).length;

        const button =
            categoryKey === null
                ? allCategoryButtonRef.current
                : categoryButtonRefs.current.get(categoryKey) ?? null;

        setCursorMode('browse', categoryKey === null ? 'show all' : 'browse aisle');
        await moveCursorToElement(button, signal, 360);
        button?.scrollIntoView({
            behavior: 'smooth',
            inline: 'center',
            block: 'nearest',
        });
        await pulseCursor(signal);

        selectedCategoryRef.current = categoryKey;
        visibleStartIndexRef.current = 0;
        startTransition(() => {
            setSelectedCategory(categoryKey);
            setVisibleStartIndex(0);
        });

        await wait(180, signal);
        hideCursor();

        return {
            selectedCategory: categoryKey,
            productCount: nextCount,
        };
    };

    const ensureProductVisible = async (
        product: TCatalogProduct,
        signal?: AbortSignal,
    ) => {
        const currentQuery = searchTextRef.current.trim().toLowerCase();
        const matchesSearch =
            currentQuery.length === 0 || product.searchText.includes(currentQuery);
        const matchesCategory =
            selectedCategoryRef.current === null ||
            product.categoryKeys.includes(selectedCategoryRef.current);

        if (!matchesSearch) {
            searchTextRef.current = '';
            startTransition(() => {
                setSearchText('');
            });
            await wait(140, signal);
        }

        if (!matchesCategory) {
            await applyCategorySelection(product.primaryCategoryKey ?? null, signal);
        }

        const currentFiltered = getFilteredProducts(
            catalog,
            selectedCategoryRef.current,
            searchTextRef.current,
        );
        const productIndex = currentFiltered.findIndex(
            (candidate) => candidate.id === product.id,
        );

        if (productIndex === -1) {
            await nextFrame(signal);
            return;
        }

        const targetStart = clampWindowStart(
            Math.floor(productIndex / MAX_VISIBLE_PRODUCTS) * MAX_VISIBLE_PRODUCTS,
            currentFiltered.length,
        );

        if (targetStart !== visibleStartIndexRef.current) {
            const direction =
                targetStart > visibleStartIndexRef.current ? 'next' : 'previous';
            const pageDistance = Math.max(
                1,
                Math.ceil(
                    Math.abs(targetStart - visibleStartIndexRef.current) /
                        MAX_VISIBLE_PRODUCTS,
                ),
            );
            await scrollCatalogWindow(direction, pageDistance, signal);
            return;
        }

        await nextFrame(signal);
    };

    const runSpotlight = async (
        productId: number,
        signal?: AbortSignal,
    ): Promise<TSpotlightResult> => {
        const product = catalog?.productMap.get(productId);
        if (!catalog || !product) {
            throw new Error(`Unknown product id: ${productId}`);
        }

        await ensureProductVisible(product, signal);

        const productCard = productCardRefs.current.get(product.id) ?? null;
        if (productCard) {
            setCursorMode('browse', 'view details');
            await moveCursorToElement(productCard, signal, 400);
            productCard.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
                inline: 'nearest',
            });
            await pulseCursor(signal);
            flashProduct(product.id);
        }

        modalProductIdRef.current = product.id;
        startTransition(() => {
            setModalProductId(product.id);
            setIsCartOpen(false);
        });

        await nextFrame(signal);
        await wait(120, signal);
        hideCursor();

        return {
            productId: product.id,
            productTitle: product.title,
        };
    };

    const animateSearch = async (
        input: z.infer<typeof animateSearchInputSchema>,
        signal?: AbortSignal,
    ): Promise<TAnimateSearchResult> => {
        if (!catalog) {
            return {
                resultCount: 0,
                leadingResultId: null,
                leadingResultTitle: null,
            };
        }

        setSearchIsAnimating(true);

        try {
            if (
                input.categoryKey !== undefined &&
                input.categoryKey !== selectedCategoryRef.current
            ) {
                await applyCategorySelection(input.categoryKey ?? null, signal);
            }

            const inputNode = searchInputRef.current;
            setCursorMode('search', 'compose query');
            await moveCursorToElement(inputNode, signal, 420);
            inputNode?.focus();
            await pulseCursor(signal);

            let draft = searchTextRef.current;
            while (draft.length > 0) {
                draft = draft.slice(0, -1);
                searchTextRef.current = draft;
                startTransition(() => setSearchText(draft));
                await wait(18, signal);
            }

            draft = '';
            for (const character of input.query) {
                draft += character;
                searchTextRef.current = draft;
                startTransition(() => setSearchText(draft));
                await wait(SEARCH_TYPING_BASE_MS, signal);
            }

            await wait(220, signal);

            const matches = getFilteredProducts(
                catalog,
                selectedCategoryRef.current,
                input.query,
            );
            const leading = matches[0] ?? null;

            if (leading) {
                await nextFrame(signal);
                const productCard = productCardRefs.current.get(leading.id) ?? null;
                productCard?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center',
                    inline: 'nearest',
                });
                flashProduct(leading.id);
            }

            hideCursor();

            return {
                resultCount: matches.length,
                leadingResultId: leading?.id ?? null,
                leadingResultTitle: leading?.title ?? null,
            };
        } finally {
            setSearchIsAnimating(false);
        }
    };

    const clearAnimatedSearch = async (
        _input: void,
        signal?: AbortSignal,
    ): Promise<TCategoryResult> => {
        setCursorMode('search', 'clear search');
        await moveCursorToElement(searchInputRef.current, signal, 320);
        await pulseCursor(signal);

        let draft = searchTextRef.current;
        while (draft.length > 0) {
            draft = draft.slice(0, -1);
            searchTextRef.current = draft;
            startTransition(() => setSearchText(draft));
            await wait(18, signal);
        }

        hideCursor();

        return {
            selectedCategory: selectedCategoryRef.current,
            productCount: getFilteredProducts(
                catalog,
                selectedCategoryRef.current,
                '',
            ).length,
        };
    };

    const mutateCart = (
        productId: number,
        quantityDelta: number,
    ): TCartSummary => {
        const nextCart = structuredClone(cartQuantitiesRef.current);
        const currentQuantity = nextCart[productId] ?? 0;
        const nextQuantity = Math.max(0, currentQuantity + quantityDelta);

        if (nextQuantity === 0) {
            delete nextCart[productId];
        } else {
            nextCart[productId] = nextQuantity;
        }

        cartQuantitiesRef.current = nextCart;
        setCartQuantities(nextCart);
        pulseCartFab();

        const nextLines = Object.entries(nextCart)
            .map(([productIdKey, quantity]) => {
                const product = catalog?.productMap.get(Number(productIdKey));
                if (!product) {
                    return null;
                }

                return {
                    productId: Number(productIdKey),
                    title: product.title,
                    quantity,
                    price: product.price,
                    lineTotal:
                        product.price === null ? null : product.price * quantity,
                    accent: product.theme.accent,
                    shell: product.theme.shell,
                    imageUrl: product.imageUrl,
                } satisfies TCartLine;
            })
            .filter((line): line is TCartLine => line !== null);

        return {
            totalItems: nextLines.reduce((sum, line) => sum + line.quantity, 0),
            subtotal: nextLines.some((line) => line.lineTotal === null)
                ? null
                : nextLines.reduce((sum, line) => sum + (line.lineTotal ?? 0), 0),
            lines: nextLines,
        };
    };

    const runCartMutation = async (
        input: z.infer<typeof cartInputSchema>,
        signal?: AbortSignal,
        options?: {
            readonly revealCart?: boolean;
        },
    ): Promise<TCartResult> => {
        if (!catalog) {
            return {totalItems: 0, subtotal: null};
        }

        const product = catalog.productMap.get(input.productId);
        if (!product) {
            throw new Error(`Unknown product id: ${input.productId}`);
        }

        if (input.quantityDelta > 0) {
            if (modalProductIdRef.current !== product.id) {
                await runSpotlight(product.id, signal);
            }

            const addButton = modalAddButtonRef.current;
            setCursorMode('cart', 'add to cart');
            await moveCursorToElement(addButton, signal, 340);
            await pulseCursor(signal);
            flashProduct(product.id);
        } else {
            await ensureProductVisible(product, signal);
            await nextFrame(signal);

            const target =
                productCardRefs.current.get(product.id) ?? searchInputRef.current ?? null;

            setCursorMode('cart', 'edit cart');
            await moveCursorToElement(target, signal, 360);
            target?.scrollIntoView?.({
                behavior: 'smooth',
                block: 'center',
                inline: 'nearest',
            });
            await pulseCursor(signal);
            flashProduct(product.id);
        }

        const nextSummary = mutateCart(product.id, input.quantityDelta);
        if (input.quantityDelta > 0 && modalProductIdRef.current === product.id) {
            modalProductIdRef.current = null;
            startTransition(() => {
                setModalProductId(null);
            });
        }

        if (options?.revealCart ?? false) {
            setIsCartOpen(true);
        }
        hideCursor();

        return {
            totalItems: nextSummary.totalItems,
            subtotal: nextSummary.subtotal,
        };
    };

    const setCartVisibility = async (
        input: z.infer<typeof cartDrawerInputSchema>,
        signal?: AbortSignal,
    ): Promise<TCartDrawerResult> => {
        if (isCartOpenRef.current !== input.open) {
            setCursorMode('cart', input.open ? 'show cart' : 'hide cart');
            await moveCursorToElement(cartFabButtonRef.current, signal, 320);
            await pulseCursor(signal);
            startTransition(() => {
                setIsCartOpen(input.open);
            });
            await wait(140, signal);
            hideCursor();
        }

        hideCursor();

        return {
            isOpen: input.open,
            totalItems: Object.values(cartQuantitiesRef.current).reduce(
                (sum, quantity) => sum + quantity,
                0,
            ),
        };
    };

    useAgentVariable('search_text', {
        schema: z.string().describe('current search text in the storefront search box'),
        value: searchText,
    });

    useAgentVariable('selected_category', {
        schema: z.string().nullable().describe('current selected category key'),
        value: selectedCategory,
    });

    useAgentVariable('featured_categories', {
        schema: z
            .array(featuredCategorySchema)
            .describe('top categories available for browsing'),
        value: featuredCategories,
    });

    useAgentVariable('visible_products', {
        schema: z
            .array(visibleProductCardSchema)
            .describe('current top visible products in the storefront window'),
        value: visibleAgentCards,
    });

    useAgentVariable('catalog_window', {
        schema: catalogWindowSchema.describe(
            'information about the current visible window of products inside the filtered catalog',
        ),
        value: catalogWindow,
    });

    useAgentVariable('spotlight_product', {
        schema: nullableSpotlightSchema.describe(
            'currently open product modal and image if a product detail view is visible',
        ),
        value: modalAgentCard,
    });

    useAgentVariable('cart_summary', {
        schema: cartSummarySchema.describe('current basket totals and lines'),
        value: cartSummary,
    });

    useAgentVariable('cart_open', {
        schema: z.boolean().describe('whether the floating cart drawer is open'),
        value: isCartOpen,
    });

    useAgentFunction('animateSearch', {
        inputSchema: animateSearchInputSchema,
        outputSchema: animateSearchOutputSchema,
        mutates: ['search_text', 'visible_products', 'selected_category'],
        func: animateSearch,
    });

    useAgentFunction('setCategory', {
        inputSchema: categorySelectionSchema,
        outputSchema: categorySelectionOutputSchema,
        mutates: ['selected_category', 'visible_products', 'catalog_window'],
        func: async (
            input: z.infer<typeof categorySelectionSchema>,
            signal?: AbortSignal,
        ) =>
            await applyCategorySelection(input.categoryKey, signal),
    });

    useAgentFunction('spotlightProduct', {
        inputSchema: spotlightInputSchema,
        outputSchema: spotlightOutputSchema,
        mutates: [
            'spotlight_product',
            'selected_category',
            'search_text',
            'visible_products',
            'catalog_window',
        ],
        func: async (
            input: z.infer<typeof spotlightInputSchema>,
            signal?: AbortSignal,
        ) =>
            await runSpotlight(input.productId, signal),
    });

    useAgentFunction('updateCart', {
        inputSchema: cartInputSchema,
        outputSchema: cartOutputSchema,
        mutates: [
            'cart_summary',
            'selected_category',
            'search_text',
            'visible_products',
            'catalog_window',
        ],
        func: async (
            input: z.infer<typeof cartInputSchema>,
            signal?: AbortSignal,
        ) => await runCartMutation(input, signal),
    });

    useAgentFunction('setCartOpen', {
        inputSchema: cartDrawerInputSchema,
        outputSchema: cartDrawerOutputSchema,
        mutates: ['cart_open'],
        func: async (
            input: z.infer<typeof cartDrawerInputSchema>,
            signal?: AbortSignal,
        ) => await setCartVisibility(input, signal),
    });

    useAgentFunction('clearSearch', {
        inputSchema: z.void(),
        outputSchema: categorySelectionOutputSchema,
        mutates: ['search_text', 'visible_products', 'catalog_window'],
        func: clearAnimatedSearch,
    });

    useAgentFunction('scrollCatalog', {
        inputSchema: scrollCatalogInputSchema,
        outputSchema: catalogWindowSchema,
        mutates: ['visible_products', 'catalog_window'],
        func: async (
            input: z.infer<typeof scrollCatalogInputSchema>,
            signal?: AbortSignal,
        ) => await scrollCatalogWindow(input.direction, input.pages ?? 1, signal),
    });

    const systemPrompt = `
        You are the concierge for a simple, stylish grocery storefront.

        Use page functions instead of assuming the catalog is fully visible.
        - visible_products only shows the current window of products.
        - catalog_window tells you whether more matches exist above or below.
        - For meal or cooking requests, decide a short ingredient list yourself from the user's goal.
        - Let search results steer your decisions. Search one ingredient at a time, inspect visible_products, keep scrolling until you find a convincing match, open the modal, add it, then clear the search and continue.
        - Do not rely on a hardcoded meal plan or assume the first visible result is correct.
        - Use the lower-level functions when the user asks for a specific product, wants a correction, or you need manual control.
        - When shopping for food, avoid household or personal-care products unless the user explicitly asks for them.
        - If a convincing plain ingredient is already visible, use it instead of scrolling toward weaker processed matches.
        - For proteins and main ingredients, prefer plain cuts or raw ingredients over cutlets, nuggets, rolls, sausages, snacks, instant noodles, stocks, or seasoning mixes unless the user asks for those specifically.
        - Prefer product categories like meat, fish, vegetables, fruits, dairy, or general grocery staples over frozen snacks or processed meat when the user is asking for core cooking ingredients.
        - Use more specific ingredient searches when needed, such as whole chicken, chicken breast, maida, soyabean oil, black pepper, or breadcrumbs.
        - If results look weak, refine the search term and try again before adding anything.

        Keep suggestions brief, practical, and easy to follow.
    `;

    const chatTheme = {
        '--pu-bg': '#18130f',
        '--pu-fg': '#f7f0e8',
        '--pu-surface': 'rgba(255,255,255,0.08)',
        '--pu-muted': 'rgba(247,240,232,0.48)',
        '--pu-divider': 'rgba(247,240,232,0.12)',
        '--pu-accent': '#d06b34',
        '--pu-shadow': '0 30px 90px rgba(39, 24, 16, 0.24)',
    } as const;

    return (
        <>
            <SystemPrompt>{systemPrompt}</SystemPrompt>

            <div className="grocery-app-shell">
                <header className="grocery-header">
                    <div className="grocery-brand">
                        <span className="grocery-kicker">Page Use Demo</span>
                        <h1>Atelier Basket</h1>
                        <p>
                            Simple grocery browsing with a floating cart, quick
                            category hops, and animated search.
                        </p>
                    </div>
                </header>

                {loadError ? (
                    <main className="grocery-error-shell">
                        <p className="grocery-kicker">Catalog unavailable</p>
                        <h2>{loadError}</h2>
                    </main>
                ) : !catalog ? (
                    <main className="grocery-loading-shell">
                        <div className="grocery-loading-shell__marquee" />
                        <p className="grocery-kicker">Syncing local snapshot</p>
                        <h2>Loading the grocery catalog.</h2>
                    </main>
                ) : (
                    <main className="grocery-main">
                        <section className="grocery-browser">
                            <section className="grocery-controls">
                                <div className="grocery-search-panel">
                                    <label
                                        htmlFor="catalog-search"
                                        className="grocery-search-label">
                                        Search products
                                    </label>

                                    <div className="grocery-search-row">
                                        <input
                                            id="catalog-search"
                                            ref={searchInputRef}
                                            value={searchText}
                                            onChange={(event) => {
                                                const nextValue = event.target.value;
                                                searchTextRef.current = nextValue;
                                                startTransition(() => setSearchText(nextValue));
                                            }}
                                            className="grocery-search-input"
                                            data-animating={searchIsAnimating ? 'true' : 'false'}
                                            placeholder="Search milk, juice, butter, noodles..."
                                        />

                                        <button
                                            type="button"
                                            className="grocery-search-reset"
                                            onClick={() => {
                                                searchTextRef.current = '';
                                                startTransition(() => setSearchText(''));
                                            }}>
                                            {searchText.length > 0 ? 'Clear' : 'Reset'}
                                        </button>
                                    </div>

                                    <p className="grocery-search-helper">
                                        Browse {selectedCategoryLabel.toLowerCase()} with a
                                        clean product grid and a cart tucked behind the
                                        floating bag button.
                                    </p>
                                </div>

                                <nav
                                    className="grocery-category-nav"
                                    aria-label="Browse product categories">
                                    <button
                                        ref={allCategoryButtonRef}
                                        type="button"
                                        data-active={selectedCategory === null ? 'true' : 'false'}
                                        className="grocery-category-pill"
                                        onClick={() => {
                                            startTransition(() => setSelectedCategory(null));
                                        }}>
                                        <span>All aisles</span>
                                        <small>{catalog.products.length}</small>
                                    </button>

                                    {featuredCategories.map((category) => (
                                        <button
                                            key={category.key}
                                            ref={(node) => {
                                                if (node) {
                                                    categoryButtonRefs.current.set(
                                                        category.key,
                                                        node,
                                                    );
                                                } else {
                                                    categoryButtonRefs.current.delete(
                                                        category.key,
                                                    );
                                                }
                                            }}
                                            type="button"
                                            data-active={
                                                selectedCategory === category.key
                                                    ? 'true'
                                                    : 'false'
                                            }
                                            className="grocery-category-pill"
                                            onClick={() => {
                                                startTransition(() => {
                                                    setSelectedCategory(category.key);
                                                });
                                            }}>
                                            <span>{category.label}</span>
                                            <small>{category.count}</small>
                                        </button>
                                    ))}
                                </nav>
                            </section>

                            <section
                                ref={gridSectionRef}
                                className="grocery-grid-shell">
                                <div className="grocery-grid-heading">
                                    <div>
                                        <span className="grocery-kicker">Easy browse</span>
                                        <h2>{selectedCategoryLabel}</h2>
                                    </div>
                                </div>

                                <div className="grocery-grid-window-nav">
                                    <div className="grocery-grid-window-nav__copy">
                                        <span className="grocery-kicker">Catalog Window</span>
                                        <p>
                                            {catalogWindow.visibleCount > 0
                                                ? `Showing ${catalogWindow.visibleFrom}-${catalogWindow.visibleTo} of ${catalogWindow.totalMatches}`
                                                : 'No matching products in this window'}
                                        </p>
                                    </div>

                                    <div className="grocery-grid-window-nav__actions">
                                        <button
                                            ref={previousWindowButtonRef}
                                            type="button"
                                            className="grocery-grid-window-nav__button"
                                            disabled={!catalogWindow.canScrollPrevious}
                                            onClick={() => {
                                                startTransition(() => {
                                                    setVisibleStartIndex((current) =>
                                                        clampWindowStart(
                                                            current -
                                                                MAX_VISIBLE_PRODUCTS,
                                                            filteredProducts.length,
                                                        ),
                                                    );
                                                });
                                            }}>
                                            Previous
                                        </button>
                                        <button
                                            ref={nextWindowButtonRef}
                                            type="button"
                                            className="grocery-grid-window-nav__button"
                                            disabled={!catalogWindow.canScrollNext}
                                            onClick={() => {
                                                startTransition(() => {
                                                    setVisibleStartIndex((current) =>
                                                        clampWindowStart(
                                                            current +
                                                                MAX_VISIBLE_PRODUCTS,
                                                            filteredProducts.length,
                                                        ),
                                                    );
                                                });
                                            }}>
                                            Next
                                        </button>
                                    </div>
                                </div>

                                {visibleProducts.length > 0 ? (
                                    <div className="grocery-product-grid">
                                        {visibleProducts.map((product) => (
                                            <ProductCard
                                                key={product.id}
                                                product={product}
                                                quantityInCart={cartQuantities[product.id] ?? 0}
                                                isHighlighted={
                                                    highlightedProductId === product.id
                                                }
                                                onOpen={() => {
                                                    openProductModal(product.id);
                                                }}
                                                registerRef={(node) => {
                                                    if (node) {
                                                        productCardRefs.current.set(
                                                            product.id,
                                                            node,
                                                        );
                                                    } else {
                                                        productCardRefs.current.delete(
                                                            product.id,
                                                        );
                                                    }
                                                }}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="grocery-empty-state">
                                        <span className="grocery-kicker">No matches</span>
                                        <h3>Try a broader search or switch aisles.</h3>
                                        <p>
                                            Reset the search or hop categories to find a
                                            cleaner set of results.
                                        </p>
                                    </div>
                                )}
                            </section>
                        </section>

                        <CartPanel
                            isOpen={isCartOpen}
                            isPulsing={cartIsPulsing}
                            cartLines={cartLines}
                            totalItems={cartSummary.totalItems}
                            subtotal={cartSummary.subtotal}
                            fabRef={(node) => {
                                cartFabButtonRef.current = node;
                            }}
                            onAdjustCart={(productId, delta) => {
                                mutateCart(productId, delta);
                            }}
                            onOpenProduct={(productId) => {
                                openProductModal(productId);
                            }}
                            onToggle={() => {
                                setIsCartOpen((current) => !current);
                            }}
                            onClose={() => {
                                setIsCartOpen(false);
                            }}
                        />
                    </main>
                )}

                {modalProduct ? (
                    <div
                        className="grocery-modal-backdrop"
                        style={modalStyle}
                        onClick={() => {
                            modalProductIdRef.current = null;
                            setModalProductId(null);
                        }}>
                        <div
                            className="grocery-modal"
                            onClick={(event) => event.stopPropagation()}>
                            <button
                                ref={modalCloseButtonRef}
                                type="button"
                                className="grocery-modal__close"
                                onClick={() => {
                                    modalProductIdRef.current = null;
                                    setModalProductId(null);
                                }}>
                                Close
                            </button>

                            <div className="grocery-modal__media">
                                <img
                                    src={modalProduct.imageUrl}
                                    alt={modalProduct.title}
                                    loading="lazy"
                                />
                            </div>

                            <div className="grocery-modal__content">
                                <span className="grocery-kicker">
                                    {modalProduct.primaryCategoryLabel ?? 'Product detail'}
                                </span>
                                <h2>{modalProduct.title}</h2>
                                <p className="grocery-modal__subtitle">
                                    {modalProduct.subtitle}
                                </p>
                                <strong className="grocery-modal__price">
                                    {formatPrice(modalProduct.price)}
                                </strong>
                                <p className="grocery-modal__copy">
                                    Palette accents stay tucked into the modal and the
                                    cart, while the main catalog stays calm and easy to
                                    browse.
                                </p>

                                <div className="grocery-modal__swatches">
                                    <i style={{backgroundColor: modalProduct.theme.accent}} />
                                    <i style={{backgroundColor: modalProduct.theme.support}} />
                                    <i style={{backgroundColor: modalProduct.theme.deep}} />
                                    <i style={{backgroundColor: modalProduct.theme.soft}} />
                                </div>

                                <div className="grocery-modal__actions">
                                    <button
                                        type="button"
                                        className="grocery-modal__secondary"
                                        onClick={() => {
                                            modalProductIdRef.current = null;
                                            setModalProductId(null);
                                        }}>
                                        Keep browsing
                                    </button>
                                    <button
                                        type="button"
                                        className="grocery-modal__primary"
                                        ref={modalAddButtonRef}
                                        onClick={() => {
                                            mutateCart(modalProduct.id, 1);
                                            modalProductIdRef.current = null;
                                            setModalProductId(null);
                                            flashProduct(modalProduct.id);
                                        }}>
                                        Add to cart
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : null}

                <FauxCursor ref={cursorRef} labelRef={cursorLabelRef} />
            </div>

            <PageUseChat
                title="ATELIER CONCIERGE"
                greeting="Tell me what you're making and I will build a simple basket from the catalog."
                placeholder="Tell me what you're making"
                suggestions={[
                    "I'm making fried chicken tonight.",
                    "Help me shop for a pasta dinner.",
                    "Build me a breakfast spread.",
                ]}
                theme="dark"
                roundedness="lg"
                cssVariables={chatTheme}
                devMode
            />
        </>
    );
};

export default App;
