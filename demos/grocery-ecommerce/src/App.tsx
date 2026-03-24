import {
    startTransition,
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
    normalizeSearchValue,
    wait,
    type TCatalogData,
    type TCatalogProduct,
    type TRawProductsPayload,
} from './lib/catalog.ts';

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

type TCatalogWindow = {
    readonly visibleFrom: number;
    readonly visibleTo: number;
    readonly visibleCount: number;
    readonly totalMatches: number;
    readonly canScrollNext: boolean;
    readonly canScrollPrevious: boolean;
};

type TFauxCursorMode = 'browse' | 'search' | 'cart';
type TRevealPlacement = 'top' | 'center' | 'bottom';

const MAX_VISIBLE_PRODUCTS = 24;
const SEARCH_TYPING_BASE_MS = 56;

const featuredCategorySchema = z
    .string()
    .describe('compact list of category keys available for browsing');

const visibleProductCardSchema = z
    .string()
    .describe('compact list of addable visible products; each line starts with the product id');

const cartSummarySchema = z
    .string()
    .describe('compact basket summary with item ids and quantities');

const nullableSpotlightSchema = z
    .string()
    .nullable()
    .describe('compact summary of the product open in the detail modal');

const catalogWindowSummarySchema = z
    .string()
    .describe('compact summary of the current result window');

const animateSearchInputSchema = z
    .object({
        query: z.string().describe('query to search for'),
        categoryKey: z
            .string()
            .nullable()
            .optional()
            .describe('optional category key to browse before searching'),
    })
    .describe('search the catalog for a product');

const animateSearchOutputSchema = z
    .object({
        resultCount: z.number().describe('number of matching products'),
        leadingResultId: z.number().nullable().describe('first matching product id if any'),
        leadingResultTitle: z
            .string()
            .nullable()
            .describe('first matching product title if any'),
    })
    .describe('search results after the query is applied');

const categorySelectionSchema = z
    .object({
        categoryKey: z
            .string()
            .nullable()
            .describe('category key to browse, or null to clear category filtering'),
    })
    .describe('change the active category filter');

const categorySelectionOutputSchema = z
    .object({
        selectedCategory: z.string().nullable().describe('resulting category key'),
        productCount: z
            .number()
            .describe('count of matching products under the current filters'),
    })
    .describe('result of changing category or clearing search');

const spotlightInputSchema = z
    .object({
        productId: z.number().describe('product id to open'),
    })
    .describe('open a product detail view');

const spotlightOutputSchema = z
    .object({
        productId: z.number().describe('opened product id'),
        productTitle: z.string().describe('opened product title'),
    })
    .describe('product now open in the detail view');

const cartInputSchema = z
    .object({
        productId: z.number().describe('product id to add or remove'),
        quantityDelta: z.number().describe('positive to add, negative to remove'),
    })
    .describe('adjust the quantity of a product in the basket');

const cartOutputSchema = z
    .object({
        totalItems: z.number().describe('total quantity after mutation'),
        subtotal: z
            .number()
            .nullable()
            .describe('basket subtotal in BDT when all prices are known'),
    })
    .describe('basket totals after the quantity change');

const catalogWindowSchema = z
    .object({
        visibleFrom: z
            .number()
            .describe('1-based index of the first visible product in the filtered list'),
        visibleTo: z
            .number()
            .describe('1-based index of the last visible product in the filtered list'),
        visibleCount: z.number().describe('count of currently visible products'),
        totalMatches: z
            .number()
            .describe('total products matching the current search and category'),
        canScrollNext: z
            .boolean()
            .describe('whether more matching products exist after the current page'),
        canScrollPrevious: z
            .boolean()
            .describe('whether earlier matching products exist before the current page'),
    })
    .describe('information about the active page of search results');

const scrollCatalogInputSchema = z
    .object({
        direction: z
            .enum(['next', 'previous'])
            .describe('which direction to move through the result pages'),
        pages: z
            .number()
            .int()
            .min(1)
            .max(6)
            .optional()
            .describe('how many result pages to move at once'),
    })
    .describe('move to a different page of visible results');

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

const boundedLevenshtein = (
    left: string,
    right: string,
    maxDistance: number,
) => {
    if (left === right) {
        return 0;
    }

    if (Math.abs(left.length - right.length) > maxDistance) {
        return null;
    }

    let previousRow = Array.from({length: right.length + 1}, (_, index) => index);

    for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
        const currentRow = [leftIndex + 1];
        let rowMinimum = currentRow[0];

        for (let rightIndex = 0; rightIndex < right.length; rightIndex += 1) {
            const substitutionCost =
                left[leftIndex] === right[rightIndex] ? 0 : 1;
            const nextValue = Math.min(
                previousRow[rightIndex + 1]! + 1,
                currentRow[rightIndex]! + 1,
                previousRow[rightIndex]! + substitutionCost,
            );

            currentRow.push(nextValue);
            rowMinimum = Math.min(rowMinimum, nextValue);
        }

        if (rowMinimum > maxDistance) {
            return null;
        }

        previousRow = currentRow;
    }

    const distance = previousRow[right.length] ?? maxDistance + 1;
    return distance <= maxDistance ? distance : null;
};

const subsequenceScore = (needle: string, haystack: string) => {
    if (needle.length < 3 || needle.length > haystack.length) {
        return null;
    }

    let matched = 0;
    for (const character of haystack) {
        if (character === needle[matched]) {
            matched += 1;
        }

        if (matched === needle.length) {
            const lengthPenalty = Math.max(0, haystack.length - needle.length);
            return 54 - Math.min(lengthPenalty * 2, 16);
        }
    }

    return null;
};

const scoreTokenMatch = (queryToken: string, candidateToken: string) => {
    if (candidateToken === queryToken) {
        return 160;
    }

    if (candidateToken.startsWith(queryToken)) {
        return 132 - Math.min(candidateToken.length - queryToken.length, 20);
    }

    if (queryToken.length >= 3 && candidateToken.includes(queryToken)) {
        return 110 - Math.min(candidateToken.indexOf(queryToken), 12);
    }

    if (queryToken.startsWith(candidateToken) && candidateToken.length >= 3) {
        return 94 - Math.min(queryToken.length - candidateToken.length, 18);
    }

    if (queryToken.length >= 4 && candidateToken.length >= 4) {
        const distance = boundedLevenshtein(queryToken, candidateToken, 2);
        if (distance !== null) {
            return 86 - distance * 18;
        }
    }

    return subsequenceScore(queryToken, candidateToken);
};

const scoreSearchMatch = (
    product: TCatalogProduct,
    selectedCategory: string | null,
    normalizedQuery: string,
) => {
    const matchesCategory =
        selectedCategory === null || product.categoryKeys.includes(selectedCategory);
    if (!matchesCategory) {
        return null;
    }

    if (normalizedQuery.length === 0) {
        return product.order;
    }

    const queryTokens = normalizedQuery.split(' ').filter(Boolean);
    const normalizedTitle = normalizeSearchValue(
        `${product.title} ${product.subtitle}`,
    );

    let score = 0;

    if (normalizedTitle === normalizedQuery) {
        score += 1400;
    } else if (normalizedTitle.startsWith(normalizedQuery)) {
        score += 1180;
    } else if (normalizedTitle.includes(normalizedQuery)) {
        score += 980;
    } else if (product.searchText.includes(normalizedQuery)) {
        score += 760;
    }

    const tokenScores = queryTokens
        .map((queryToken) => {
            let bestScore: number | null = null;

            for (const candidateToken of product.searchTokens) {
                const candidateScore = scoreTokenMatch(queryToken, candidateToken);
                if (
                    candidateScore !== null &&
                    (bestScore === null || candidateScore > bestScore)
                ) {
                    bestScore = candidateScore;
                }
            }

            return bestScore;
        })
        .filter((tokenScore): tokenScore is number => tokenScore !== null);

    const matchedTokenCount = tokenScores.length;
    if (matchedTokenCount === 0) {
        return null;
    }

    const allTokensMatched = matchedTokenCount === queryTokens.length;
    const coverage = matchedTokenCount / queryTokens.length;
    if (!allTokensMatched && score < 760 && coverage < 0.6) {
        return null;
    }

    score += tokenScores.reduce((sum, tokenScore) => sum + tokenScore, 0);
    score += matchedTokenCount * 85;
    score += allTokensMatched ? 120 : 0;
    score -= Math.max(0, product.searchTokens.length - queryTokens.length) * 1.5;

    return score;
};

const getFilteredProducts = (
    catalog: TCatalogData | null,
    selectedCategory: string | null,
    query: string,
) => {
    if (!catalog) {
        return [];
    }

    const normalizedQuery = normalizeSearchValue(query);
    if (normalizedQuery.length === 0) {
        return catalog.products.filter(
            (product) =>
                selectedCategory === null ||
                product.categoryKeys.includes(selectedCategory),
        );
    }

    return catalog.products
        .map((product) => ({
            product,
            score: scoreSearchMatch(product, selectedCategory, normalizedQuery),
        }))
        .filter(
            (
                scoredProduct,
            ): scoredProduct is {product: TCatalogProduct; score: number} =>
                scoredProduct.score !== null,
        )
        .sort((left, right) => {
            if (right.score !== left.score) {
                return right.score - left.score;
            }

            return left.product.order - right.product.order;
        })
        .map(({product}) => product);
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
    const [searchDraft, setSearchDraft] = useState('');
    const [modalProductId, setModalProductId] = useState<number | null>(null);
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [visibleStartIndex, setVisibleStartIndex] = useState(0);
    const [cartQuantities, setCartQuantities] = useState<Record<number, number>>({});
    const [cartActivity, setCartActivity] = useState<Record<number, number>>({});
    const [cartIsPulsing, setCartIsPulsing] = useState(false);
    const [searchIsAnimating, setSearchIsAnimating] = useState(false);
    const [highlightedProductId, setHighlightedProductId] = useState<number | null>(
        null,
    );
    const [agentAction, setAgentAction] = useState<{
        readonly mode: TFauxCursorMode;
        readonly label: string;
    } | null>(null);
    const [activeUiTarget, setActiveUiTarget] = useState<string | null>(null);

    const selectedCategoryRef = useRef<string | null>(selectedCategory);
    const searchTextRef = useRef(searchText);
    const searchDraftRef = useRef(searchDraft);
    const visibleStartIndexRef = useRef(visibleStartIndex);
    const isCartOpenRef = useRef(isCartOpen);
    const modalProductIdRef = useRef<number | null>(modalProductId);
    const cartQuantitiesRef = useRef(cartQuantities);
    const cartActivityRef = useRef(cartActivity);
    const cartActivityCounterRef = useRef(0);
    const highlightTimerRef = useRef<number | null>(null);
    const cartPulseTimerRef = useRef<number | null>(null);

    const searchInputRef = useRef<HTMLInputElement | null>(null);
    const searchSubmitButtonRef = useRef<HTMLButtonElement | null>(null);
    const searchClearButtonRef = useRef<HTMLButtonElement | null>(null);
    const searchPanelRef = useRef<HTMLDivElement | null>(null);
    const allCategoryButtonRef = useRef<HTMLButtonElement | null>(null);
    const categoryButtonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
    const productCardRefs = useRef<Map<number, HTMLElement>>(new Map());
    const gridSectionRef = useRef<HTMLElement | null>(null);
    const gridHeadingRef = useRef<HTMLDivElement | null>(null);
    const gridWindowNavRef = useRef<HTMLDivElement | null>(null);
    const previousWindowButtonRef = useRef<HTMLButtonElement | null>(null);
    const nextWindowButtonRef = useRef<HTMLButtonElement | null>(null);
    const cartPanelRef = useRef<HTMLElement | null>(null);
    const cartLineRefs = useRef<Map<number, HTMLElement>>(new Map());
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
        searchDraftRef.current = searchDraft;
    }, [searchDraft]);

    useEffect(() => {
        visibleStartIndexRef.current = visibleStartIndex;
    }, [visibleStartIndex]);

    useEffect(() => {
        isCartOpenRef.current = isCartOpen;
    }, [isCartOpen]);

    useEffect(() => {
        modalProductIdRef.current = modalProductId;
    }, [modalProductId]);

    useEffect(() => {
        cartQuantitiesRef.current = cartQuantities;
    }, [cartQuantities]);

    useEffect(() => {
        cartActivityRef.current = cartActivity;
    }, [cartActivity]);

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
        () => getFilteredProducts(catalog, selectedCategory, searchText),
        [catalog, searchText, selectedCategory],
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
            .sort((left, right) => {
                const rightActivity = cartActivity[right.productId] ?? 0;
                const leftActivity = cartActivity[left.productId] ?? 0;

                if (rightActivity !== leftActivity) {
                    return rightActivity - leftActivity;
                }

                return 0;
            });
    }, [catalog, cartActivity, cartQuantities]);

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

    const featuredCategorySummary = useMemo(
        () =>
            featuredCategories.length > 0
                ? featuredCategories
                      .map((category) => `${category.key}: ${category.label}`)
                      .join(' | ')
                : 'none',
        [featuredCategories],
    );

    const visibleAgentCards = useMemo(
        () =>
            visibleProducts
                .filter((product) => product.price !== null)
                .map((product) => `#${product.id} ${product.title}`)
                .join('\n') || 'none',
        [visibleProducts],
    );

    const catalogWindowSummary = useMemo(() => {
        if (catalogWindow.totalMatches === 0) {
            return '0 results';
        }

        return `${catalogWindow.visibleFrom}-${catalogWindow.visibleTo} of ${catalogWindow.totalMatches}; previous ${catalogWindow.canScrollPrevious ? 'yes' : 'no'}; next ${catalogWindow.canScrollNext ? 'yes' : 'no'}`;
    }, [catalogWindow]);

    const modalAgentCard = modalProduct
        ? `#${modalProduct.id} ${modalProduct.title}${modalProduct.subtitle ? ` — ${modalProduct.subtitle}` : ''}${modalProduct.price === null ? '' : ` — ৳${modalProduct.price.toLocaleString('en-US')}`}`
        : null;

    const cartSummaryText = useMemo(() => {
        if (cartLines.length === 0) {
            return 'empty';
        }

        const subtotalText =
            cartSummary.subtotal === null
                ? 'mixed pricing'
                : `৳${cartSummary.subtotal.toLocaleString('en-US')}`;
        const lineSummary = cartLines
            .slice(0, 8)
            .map((line) => `#${line.productId} ${line.title} x${line.quantity}`)
            .join(' | ');
        const remainder =
            cartLines.length > 8 ? ` | +${cartLines.length - 8} more` : '';

        return `${cartSummary.totalItems} items, subtotal ${subtotalText}. ${lineSummary}${remainder}`;
    }, [cartLines, cartSummary.subtotal, cartSummary.totalItems]);

    const selectedCategoryLabel = selectedCategory
        ? catalog?.categoryMap.get(selectedCategory)?.label ?? 'Selected aisle'
        : 'Products';

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

    const waitForUi = async (signal?: AbortSignal, delay = 180) => {
        await nextFrame(signal);
        await wait(delay, signal);
        await nextFrame(signal);
    };

    const revealElement = async (
        element: Element | null,
        placement: TRevealPlacement = 'center',
        signal?: AbortSignal,
        behavior: ScrollBehavior = 'smooth',
    ) => {
        if (!element) {
            return;
        }

        const rect = element.getBoundingClientRect();
        const absoluteTop = window.scrollY + rect.top;
        const padding = 20;
        const topSafeZone = placement === 'top' ? 18 : 72;
        const bottomSafeZone = placement === 'bottom' ? 18 : 96;
        const isAlreadyVisible =
            rect.top >= topSafeZone &&
            rect.bottom <= window.innerHeight - bottomSafeZone;
        const maxScrollTop = Math.max(
            0,
            document.documentElement.scrollHeight - window.innerHeight,
        );

        if (isAlreadyVisible) {
            await nextFrame(signal);
            return;
        }

        let targetTop = window.scrollY;
        if (placement === 'top') {
            targetTop = absoluteTop - padding;
        } else if (placement === 'bottom') {
            targetTop = absoluteTop - window.innerHeight + rect.height + padding;
        } else {
            targetTop = absoluteTop - (window.innerHeight - rect.height) / 2;
        }

        const clampedTargetTop = Math.max(
            0,
            Math.min(Math.round(targetTop), maxScrollTop),
        );

        if (Math.abs(clampedTargetTop - window.scrollY) < 12) {
            await nextFrame(signal);
            return;
        }

        window.scrollTo({
            top: clampedTargetTop,
            behavior,
        });

        await wait(180, signal);
        await nextFrame(signal);
        await nextFrame(signal);
    };

    const scrollSearchAreaIntoView = async (
        signal?: AbortSignal,
        behavior: ScrollBehavior = 'smooth',
    ) => {
        await revealElement(searchPanelRef.current, 'top', signal, behavior);
    };

    const revealCategoryButton = async (
        button: HTMLButtonElement | null,
        signal?: AbortSignal,
    ) => {
        await revealElement(searchPanelRef.current, 'top', signal);
        button?.scrollIntoView({
            behavior: 'smooth',
            inline: 'center',
            block: 'nearest',
        });
        await wait(180, signal);
        await nextFrame(signal);
    };

    const revealCatalogResults = async (signal?: AbortSignal) => {
        await revealElement(gridHeadingRef.current ?? gridSectionRef.current, 'top', signal);
    };

    const revealCatalogFooter = async (signal?: AbortSignal) => {
        await revealElement(
            gridWindowNavRef.current ?? gridSectionRef.current,
            'bottom',
            signal,
        );
    };

    const revealCartPanel = async (
        signal?: AbortSignal,
        options?: {
            readonly openIfNeeded?: boolean;
        },
    ) => {
        if (options?.openIfNeeded && !isCartOpenRef.current) {
            isCartOpenRef.current = true;
            startTransition(() => {
                setIsCartOpen(true);
            });
            await waitForUi(signal, 80);
            return;
        }

        await nextFrame(signal);
    };

    const revealCartLine = async (
        productId: number,
        signal?: AbortSignal,
        options?: {
            readonly openIfNeeded?: boolean;
        },
    ) => {
        await revealCartPanel(signal, options);
        const line = cartLineRefs.current.get(productId) ?? null;
        line?.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'nearest',
        });
        await wait(90, signal);
        await nextFrame(signal);
    };

    const clearSearchState = async (
        signal?: AbortSignal,
        options?: {
            readonly animate?: boolean;
        },
    ): Promise<TCategoryResult> => {
        if (options?.animate) {
            setActiveUiTarget('search-panel');
            setCursorMode('search', 'show search');
            await scrollSearchAreaIntoView(signal);

            setActiveUiTarget('search-clear');
            setCursorMode('search', 'clear search');
            await moveCursorToElement(searchClearButtonRef.current, signal, 320);
            await pulseCursor(signal);
        }

        searchDraftRef.current = '';
        searchTextRef.current = '';
        visibleStartIndexRef.current = 0;
        startTransition(() => {
            setSearchDraft('');
            setSearchText('');
            setVisibleStartIndex(0);
        });

        await waitForUi(signal, 180);

        return {
            selectedCategory: selectedCategoryRef.current,
            productCount: getFilteredProducts(
                catalog,
                selectedCategoryRef.current,
                '',
            ).length,
        };
    };

    const commitSearchQuery = async (
        nextQuery: string,
        signal?: AbortSignal,
        options?: {
            readonly animateButton?: boolean;
        },
    ): Promise<TAnimateSearchResult> => {
        const committedQuery = nextQuery.trim();

        if (options?.animateButton) {
            setActiveUiTarget('search-submit');
            setCursorMode('search', 'run search');
            await moveCursorToElement(searchSubmitButtonRef.current, signal, 280);
            await pulseCursor(signal);
        }

        searchDraftRef.current = committedQuery;
        searchTextRef.current = committedQuery;
        visibleStartIndexRef.current = 0;
        startTransition(() => {
            setSearchDraft(committedQuery);
            setSearchText(committedQuery);
            setVisibleStartIndex(0);
        });

        await waitForUi(signal, 220);

        const matches = getFilteredProducts(
            catalog,
            selectedCategoryRef.current,
            committedQuery,
        );
        const pricedMatches = matches.filter((product) => product.price !== null);
        const leading = pricedMatches[0] ?? null;

        return {
            resultCount: pricedMatches.length,
            leadingResultId: leading?.id ?? null,
            leadingResultTitle: leading?.title ?? null,
        };
    };

    const runManualSearch = () => {
        void (async () => {
            await scrollSearchAreaIntoView(undefined);
            await commitSearchQuery(searchDraftRef.current);
        })();
    };

    const runManualClear = () => {
        void (async () => {
            await scrollSearchAreaIntoView(undefined);
            await clearSearchState(undefined);
        })();
    };

    const openProductModal = (productId: number) => {
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
        setAgentAction({mode, label});
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
        setAgentAction(null);
        setActiveUiTarget(null);
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
        try {
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

                setActiveUiTarget(`window:${direction}`);
                setCursorMode(
                    'browse',
                    direction === 'next' ? 'next page' : 'previous page',
                );
                await revealCatalogFooter(signal);
                await moveCursorToElement(
                    button ?? gridWindowNavRef.current ?? gridSectionRef.current,
                    signal,
                    340,
                );
                await pulseCursor(signal);

                currentStart = nextStart;
                visibleStartIndexRef.current = nextStart;

                startTransition(() => {
                    setVisibleStartIndex(nextStart);
                });

                await waitForUi(signal, 180);
                await revealCatalogResults(signal);
            }

            return buildCatalogWindow(currentFiltered, currentStart);
        } finally {
            hideCursor();
        }
    };

    const applyCategorySelection = async (
        categoryKey: string | null,
        signal?: AbortSignal,
    ): Promise<TCategoryResult> => {
        try {
            const nextCount = getFilteredProducts(
                catalog,
                categoryKey,
                searchTextRef.current,
            ).length;

            const button =
                categoryKey === null
                    ? allCategoryButtonRef.current
                    : categoryButtonRefs.current.get(categoryKey) ?? null;

            setActiveUiTarget(
                categoryKey === null ? 'category:all' : `category:${categoryKey}`,
            );
            setCursorMode(
                'browse',
                categoryKey === null ? 'show all' : 'browse aisle',
            );
            await revealCategoryButton(button, signal);
            await moveCursorToElement(button, signal, 360);
            await pulseCursor(signal);

            selectedCategoryRef.current = categoryKey;
            visibleStartIndexRef.current = 0;
            startTransition(() => {
                setSelectedCategory(categoryKey);
                setVisibleStartIndex(0);
            });

            await waitForUi(signal);

            return {
                selectedCategory: categoryKey,
                productCount: nextCount,
            };
        } finally {
            hideCursor();
        }
    };

    const ensureProductVisible = async (
        product: TCatalogProduct,
        signal?: AbortSignal,
    ) => {
        const currentQuery = normalizeSearchValue(searchTextRef.current);
        const matchesSearch =
            currentQuery.length === 0 ||
            scoreSearchMatch(product, null, currentQuery) !== null;
        const matchesCategory =
            selectedCategoryRef.current === null ||
            product.categoryKeys.includes(selectedCategoryRef.current);

        if (!matchesSearch) {
            await clearSearchState(signal, {animate: true});
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
        try {
            const product = catalog?.productMap.get(productId);
            if (!catalog || !product) {
                throw new Error(`Unknown product id: ${productId}`);
            }

            await ensureProductVisible(product, signal);

            const productCard = productCardRefs.current.get(product.id) ?? null;
            if (productCard) {
                setActiveUiTarget(`product:${product.id}`);
                setCursorMode('browse', 'view details');
                await revealElement(productCard, 'center', signal);
                await moveCursorToElement(productCard, signal, 400);
                await pulseCursor(signal);
                flashProduct(product.id);
            }

            modalProductIdRef.current = product.id;
            startTransition(() => {
                setModalProductId(product.id);
            });

            await nextFrame(signal);
            await wait(120, signal);

            return {
                productId: product.id,
                productTitle: product.title,
            };
        } finally {
            hideCursor();
        }
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

            setActiveUiTarget('search-panel');
            setCursorMode('search', 'show search');
            await scrollSearchAreaIntoView(signal);

            const inputNode = searchInputRef.current;
            setActiveUiTarget('search-panel');
            setCursorMode('search', 'compose query');
            await moveCursorToElement(inputNode, signal, 420);
            inputNode?.focus();
            await pulseCursor(signal);

            let draft = searchDraftRef.current;
            while (draft.length > 0) {
                draft = draft.slice(0, -1);
                searchDraftRef.current = draft;
                startTransition(() => setSearchDraft(draft));
                await wait(28, signal);
            }

            draft = '';
            for (const character of input.query) {
                draft += character;
                searchDraftRef.current = draft;
                startTransition(() => setSearchDraft(draft));
                await wait(SEARCH_TYPING_BASE_MS, signal);
            }

            await wait(220, signal);

            const result = await commitSearchQuery(draft, signal, {
                animateButton: true,
            });

            return result;
        } finally {
            setSearchIsAnimating(false);
            hideCursor();
        }
    };

    const clearAnimatedSearch = async (
        _input: void,
        signal?: AbortSignal,
    ): Promise<TCategoryResult> => {
        try {
            return await clearSearchState(signal, {animate: true});
        } finally {
            hideCursor();
        }
    };

    const mutateCart = (
        productId: number,
        quantityDelta: number,
    ): TCartSummary => {
        const product = catalog?.productMap.get(productId);
        if (quantityDelta > 0 && product?.price === null) {
            return cartSummary;
        }

        const nextCart = {...cartQuantitiesRef.current};
        const nextCartActivity = {...cartActivityRef.current};
        const currentQuantity = nextCart[productId] ?? 0;
        const nextQuantity = Math.max(0, currentQuantity + quantityDelta);

        if (nextQuantity === 0) {
            delete nextCart[productId];
            delete nextCartActivity[productId];
        } else {
            nextCart[productId] = nextQuantity;
            if (nextCartActivity[productId] === undefined) {
                cartActivityCounterRef.current += 1;
                nextCartActivity[productId] = cartActivityCounterRef.current;
            }
        }

        cartQuantitiesRef.current = nextCart;
        cartActivityRef.current = nextCartActivity;
        setCartQuantities(nextCart);
        setCartActivity(nextCartActivity);
        if (quantityDelta > 0) {
            isCartOpenRef.current = true;
            setIsCartOpen(true);
        }
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
    ): Promise<TCartResult> => {
        try {
            if (!catalog) {
                return {totalItems: 0, subtotal: null};
            }

            const product = catalog.productMap.get(input.productId);
            if (!product) {
                throw new Error(`Unknown product id: ${input.productId}`);
            }

            if (input.quantityDelta > 0 && product.price === null) {
                return {
                    totalItems: cartSummary.totalItems,
                    subtotal: cartSummary.subtotal,
                };
            }

            if (input.quantityDelta > 0) {
                if (modalProductIdRef.current !== product.id) {
                    await runSpotlight(product.id, signal);
                }

                const addButton = modalAddButtonRef.current;
                setActiveUiTarget('modal:add');
                setCursorMode('cart', 'add to cart');
                await moveCursorToElement(addButton, signal, 340);
                await pulseCursor(signal);
                flashProduct(product.id);
            } else {
                const quantityInCart = cartQuantitiesRef.current[product.id] ?? 0;
                const cartLine = cartLineRefs.current.get(product.id) ?? null;

                if (quantityInCart > 0 && cartLine) {
                    setCursorMode('cart', 'trim basket');
                    setActiveUiTarget(`cart:line:${product.id}`);
                    await revealCartLine(product.id, signal, {openIfNeeded: true});
                    await moveCursorToElement(cartLine, signal, 360);
                } else {
                    await ensureProductVisible(product, signal);
                    await nextFrame(signal);

                    const target =
                        productCardRefs.current.get(product.id) ??
                        searchInputRef.current ??
                        null;

                    setCursorMode('cart', 'edit cart');
                    setActiveUiTarget(`product:${product.id}`);
                    await revealElement(
                        target,
                        target === searchInputRef.current ? 'top' : 'center',
                        signal,
                    );
                    await moveCursorToElement(target, signal, 360);
                }
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

            await waitForUi(signal, 80);
            if (input.quantityDelta > 0) {
                setActiveUiTarget(`cart:line:${product.id}`);
                setCursorMode('cart', 'review basket');
                await revealCartPanel(signal, {openIfNeeded: true});
                await moveCursorToElement(
                    cartLineRefs.current.get(product.id) ?? cartPanelRef.current,
                    signal,
                    240,
                );
            }

            return {
                totalItems: nextSummary.totalItems,
                subtotal: nextSummary.subtotal,
            };
        } finally {
            hideCursor();
        }
    };

    const runManualPageChange = (direction: 'next' | 'previous') => {
        const nextStart = clampWindowStart(
            visibleStartIndexRef.current +
                (direction === 'next'
                    ? MAX_VISIBLE_PRODUCTS
                    : -MAX_VISIBLE_PRODUCTS),
            filteredProducts.length,
        );

        if (nextStart === visibleStartIndexRef.current) {
            return;
        }

        visibleStartIndexRef.current = nextStart;
        startTransition(() => {
            setVisibleStartIndex(nextStart);
        });

        void (async () => {
            await waitForUi(undefined, 180);
            await revealCatalogResults(undefined);
        })();
    };

    const runManualAddToCart = (productId: number) => {
        const product = catalog?.productMap.get(productId);
        if (!product || product.price === null) {
            return;
        }

        mutateCart(productId, 1);
        modalProductIdRef.current = null;
        setModalProductId(null);
        flashProduct(productId);

        void (async () => {
            await waitForUi(undefined, 80);
            await revealCartPanel(undefined, {openIfNeeded: true});
        })();
    };

    useAgentVariable('search_text', {
        schema: z.string().describe('current submitted search text in the storefront'),
        value: searchText,
    });

    useAgentVariable('selected_category', {
        schema: z.string().nullable().describe('current selected category key'),
        value: selectedCategory,
    });

    useAgentVariable('featured_categories', {
        schema: featuredCategorySchema,
        value: featuredCategorySummary,
    });

    useAgentVariable('visible_products', {
        schema: visibleProductCardSchema,
        value: visibleAgentCards,
    });

    useAgentVariable('catalog_window', {
        schema: catalogWindowSummarySchema,
        value: catalogWindowSummary,
    });

    useAgentVariable('spotlight_product', {
        schema: nullableSpotlightSchema,
        value: modalAgentCard,
    });

    useAgentVariable('cart_summary', {
        schema: cartSummarySchema,
        value: cartSummaryText,
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
            'spotlight_product',
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
        You are the concierge for a simple grocery storefront.

        Page functions already handle scrolling, reveals, and motion.
        - visible_products is a compact line list of addable results, and each line starts with the product id.
        - featured_categories is a compact key: label list for category browsing.
        - Clean vague user wording into likely product search terms before searching.
        - Search is the main way to find products.
        - For meal, recipe, ingredient-list, or grocery-list requests, handle one product at a time: search, inspect results, refine or paginate if needed, open the best match, add it, then move on.
        - When searching, inspect up to 3 result pages before changing strategy.
        - If results are weak or mismatched, try different search terms before giving up. Prefer obvious variants and more specific product wording, such as liquid milk instead of milk.
        - If search is still noisy, use category selection to narrow the result set and then search again.
        - Never cycle through the full catalog or keep paging indefinitely.
        - If targeted searches and category narrowing still do not surface a convincing match, ask the user a short clarifying question instead of scanning the whole catalog.
        - Skip price-on-request items because they cannot be added to cart.
        - For vague user requests, choose the best fit from the visible options, not just the first relevant result.
        - Prefer practical formats and cuts that match likely intent: for example, larger cooking-oil bottles over tiny ones when the user asks for oil, and cut chicken pieces, drumsticks, or full chicken over boneless chicken when the user asks for fried chicken unless they ask otherwise.
        - Prefer plain ingredients over processed substitutes unless the user asks for the processed version.
        - Avoid household or personal-care items unless the user asks for them.

        Keep suggestions brief and practical.
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

    const activeCartProductId = activeUiTarget?.startsWith('cart:line:')
        ? Number(activeUiTarget.slice('cart:line:'.length))
        : null;

    return (
        <>
            <SystemPrompt>{systemPrompt}</SystemPrompt>

            <div className="grocery-app-shell">
                <div
                    className="grocery-agent-status"
                    data-visible={agentAction ? 'true' : 'false'}
                    data-mode={agentAction?.mode ?? 'browse'}
                    aria-live="polite">
                    <span className="grocery-agent-status__eyebrow">
                        <i aria-hidden="true" />
                        Assistant action
                    </span>
                    <strong>{agentAction?.label ?? 'Idle'}</strong>
                </div>

                <header className="grocery-header">
                    <div className="grocery-brand">
                        <h1>Atelier Basket</h1>
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
                        <h2>Loading products.</h2>
                    </main>
                ) : (
                    <main className="grocery-main">
                        <div
                            className="grocery-main-layout"
                            data-cart-open={isCartOpen ? 'true' : 'false'}>
                            <section className="grocery-browser">
                                <section className="grocery-controls">
                                    <div
                                        ref={searchPanelRef}
                                        className="grocery-search-panel"
                                        data-agent-active={
                                            activeUiTarget === 'search-panel'
                                                ? 'true'
                                                : 'false'
                                        }>
                                        <label
                                            htmlFor="catalog-search"
                                            className="grocery-search-label">
                                            Search products
                                        </label>

                                        <form
                                            className="grocery-search-row"
                                            onSubmit={(event) => {
                                                event.preventDefault();
                                                runManualSearch();
                                            }}>
                                            <input
                                                id="catalog-search"
                                                ref={searchInputRef}
                                                value={searchDraft}
                                                onChange={(event) => {
                                                    const nextValue = event.target.value;
                                                    searchDraftRef.current = nextValue;
                                                    startTransition(() => setSearchDraft(nextValue));
                                                }}
                                                className="grocery-search-input"
                                                data-animating={searchIsAnimating ? 'true' : 'false'}
                                                data-agent-active={
                                                    activeUiTarget === 'search-panel'
                                                        ? 'true'
                                                        : 'false'
                                                }
                                                placeholder="Search milk, juice, butter, noodles..."
                                            />

                                            <div className="grocery-search-actions">
                                                <button
                                                    ref={searchSubmitButtonRef}
                                                    type="submit"
                                                    className="grocery-search-submit"
                                                    data-agent-active={
                                                        activeUiTarget === 'search-submit'
                                                            ? 'true'
                                                            : 'false'
                                                    }>
                                                    Search
                                                </button>

                                                <button
                                                    ref={searchClearButtonRef}
                                                    type="button"
                                                    className="grocery-search-reset"
                                                    data-agent-active={
                                                        activeUiTarget === 'search-clear'
                                                            ? 'true'
                                                            : 'false'
                                                    }
                                                    onClick={runManualClear}>
                                                    Clear
                                                </button>
                                            </div>
                                        </form>
                                    </div>

                                    <nav
                                        className="grocery-category-nav"
                                        aria-label="Browse product categories">
                                        <button
                                            ref={allCategoryButtonRef}
                                            type="button"
                                            data-active={selectedCategory === null ? 'true' : 'false'}
                                            data-agent-active={
                                                activeUiTarget === 'category:all'
                                                    ? 'true'
                                                    : 'false'
                                            }
                                            className="grocery-category-pill"
                                            onClick={() => {
                                                startTransition(() => setSelectedCategory(null));
                                            }}>
                                            <span>All aisles</span>
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
                                                data-agent-active={
                                                    activeUiTarget ===
                                                    `category:${category.key}`
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
                                            </button>
                                        ))}
                                    </nav>
                                </section>

                                <section
                                    ref={gridSectionRef}
                                    className="grocery-grid-shell">
                                    <div
                                        ref={gridHeadingRef}
                                        className="grocery-grid-heading">
                                        <div className="grocery-grid-heading__copy">
                                            <h2>{selectedCategoryLabel}</h2>
                                            <p className="grocery-grid-heading__meta">
                                                {catalogWindow.totalMatches > 0
                                                    ? `${catalogWindow.totalMatches} curated matches`
                                                    : 'No matching products yet'}
                                            </p>
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
                                                    isAgentActive={
                                                        activeUiTarget ===
                                                        `product:${product.id}`
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
                                            <h3>No products found</h3>
                                        </div>
                                    )}

                                    <div
                                        ref={gridWindowNavRef}
                                        className="grocery-grid-window-nav">
                                        <p className="grocery-grid-window-nav__status">
                                            {catalogWindow.visibleCount > 0
                                                ? `${catalogWindow.visibleFrom}-${catalogWindow.visibleTo} of ${catalogWindow.totalMatches}`
                                                : 'No matching products'}
                                        </p>

                                        <div className="grocery-grid-window-nav__actions">
                                            <button
                                                ref={previousWindowButtonRef}
                                                type="button"
                                                className="grocery-grid-window-nav__button"
                                                data-agent-active={
                                                    activeUiTarget === 'window:previous'
                                                        ? 'true'
                                                        : 'false'
                                                }
                                                disabled={!catalogWindow.canScrollPrevious}
                                                onClick={() => {
                                                    runManualPageChange('previous');
                                                }}>
                                                Previous
                                            </button>
                                            <button
                                                ref={nextWindowButtonRef}
                                                type="button"
                                                className="grocery-grid-window-nav__button"
                                                data-agent-active={
                                                    activeUiTarget === 'window:next'
                                                        ? 'true'
                                                        : 'false'
                                                }
                                                disabled={!catalogWindow.canScrollNext}
                                                onClick={() => {
                                                    runManualPageChange('next');
                                                }}>
                                                Next
                                            </button>
                                        </div>
                                    </div>
                                </section>
                            </section>

                            <CartPanel
                                isOpen={isCartOpen}
                                isPulsing={cartIsPulsing}
                                cartLines={cartLines}
                                totalItems={cartSummary.totalItems}
                                subtotal={cartSummary.subtotal}
                                activeProductId={activeCartProductId}
                                isAgentActive={activeUiTarget?.startsWith('cart:') ?? false}
                                registerPanelRef={(node) => {
                                    cartPanelRef.current = node;
                                }}
                                registerLineRef={(productId, node) => {
                                    if (node) {
                                        cartLineRefs.current.set(productId, node);
                                    } else {
                                        cartLineRefs.current.delete(productId);
                                    }
                                }}
                                onAdjustCart={(productId, delta) => {
                                    mutateCart(productId, delta);
                                }}
                                onOpenProduct={(productId) => {
                                    openProductModal(productId);
                                }}
                                onToggle={() => {
                                    isCartOpenRef.current = !isCartOpenRef.current;
                                    setIsCartOpen((current) => !current);
                                }}
                                onClose={() => {
                                    isCartOpenRef.current = false;
                                    setIsCartOpen(false);
                                }}
                            />
                        </div>
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
                            data-agent-active={
                                activeUiTarget === 'modal:add' ? 'true' : 'false'
                            }
                            onClick={(event) => event.stopPropagation()}>
                            <button
                                type="button"
                                className="grocery-modal__close"
                                aria-label="Close product"
                                onClick={() => {
                                    modalProductIdRef.current = null;
                                    setModalProductId(null);
                                }}>
                                ×
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

                                <div className="grocery-modal__swatches">
                                    <i style={{backgroundColor: modalProduct.theme.accent}} />
                                    <i style={{backgroundColor: modalProduct.theme.support}} />
                                    <i style={{backgroundColor: modalProduct.theme.deep}} />
                                    <i style={{backgroundColor: modalProduct.theme.soft}} />
                                </div>

                                <div className="grocery-modal__actions">
                                    <button
                                        type="button"
                                        className="grocery-modal__primary"
                                        ref={modalAddButtonRef}
                                        disabled={modalProduct.price === null}
                                        data-agent-active={
                                            activeUiTarget === 'modal:add'
                                                ? 'true'
                                                : 'false'
                                        }
                                        onClick={() => {
                                            runManualAddToCart(modalProduct.id);
                                        }}>
                                        {modalProduct.price === null
                                            ? 'Ask for price'
                                            : 'Add to cart'}
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
                greeting="Ask for a specific item, a short shopping list, a recipe basket, or help finding the closest match in the catalog."
                placeholder="Find, add, or build any grocery basket"
                suggestions={[
                    "I'm making fried chicken tonight.",
                    'Add Greek yogurt, granola, and blueberries.',
                    'Find a good salted butter and add it.',
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
