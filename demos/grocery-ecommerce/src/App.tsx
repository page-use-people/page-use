import {
    startTransition,
    useEffect,
    useEffectEvent,
    useMemo,
    useRef,
    useState,
} from 'react';
import {useQuery} from '@tanstack/react-query';
import {PageUseChat} from '@page-use/react/ui/chat';
import {
    SystemPrompt,
    useAgentFunction,
    useAgentVariable,
    z,
} from '@page-use/react';
import {
    CatalogBrowser,
    type TCatalogBrowserCategory,
} from './components/CatalogBrowser.tsx';
import {CartPanel} from './components/CartPanel.tsx';
import {FauxCursor} from './components/FauxCursor.tsx';
import {
    normalizeSearchValue,
    wait,
    type TCatalogProduct,
} from './lib/catalog.ts';
import {
    MAX_VISIBLE_PRODUCTS,
    SEARCH_TYPING_BASE_MS,
    buildCatalogWindow,
    catalogQueryOptions,
    clampWindowStart,
    getFilteredProducts,
    type TAnimateSearchResult,
    type TCatalogWindow,
    type TCategoryResult,
} from './lib/catalog-browser.ts';
import {
    buildCartLines,
    mutateCartStateBatch,
    summarizeCartLines,
    type TCartMutation,
    type TCartSummary,
} from './lib/cart.ts';
import {
    animateSearchInputSchema,
    animateSearchOutputSchema,
    cartInputSchema,
    cartOutputSchema,
    cartSummarySchema,
    catalogWindowSchema,
    catalogWindowSummarySchema,
    categorySelectionOutputSchema,
    categorySelectionSchema,
    chatTheme,
    featuredCategorySchema,
    scrollCatalogInputSchema,
    searchStatusSchema,
    systemPrompt,
    visibleProductCardSchema,
    type TCartResult,
} from './lib/assistant.ts';

type TFauxCursorMode = 'browse' | 'search' | 'cart';
type TRevealPlacement = 'top' | 'center' | 'bottom';

const AGENT_MUTATION_TIMEOUT_MS = 8_000;
const SEARCH_INPUT_DEBOUNCE_MS = 120;
const SEARCH_LOADING_MIN_MS = 260;
const SEARCH_SETTLE_POLL_MS = 24;

const nextFrame = (signal?: AbortSignal) =>
    new Promise<void>((resolve, reject) => {
        if (signal?.aborted) {
            reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
            return;
        }

        const onAbort = () => {
            window.cancelAnimationFrame(frame);
            reject(signal?.reason ?? new DOMException('Aborted', 'AbortError'));
        };

        const frame = window.requestAnimationFrame(() => {
            signal?.removeEventListener('abort', onAbort);
            resolve();
        });

        signal?.addEventListener('abort', onAbort, {once: true});
    });

const easeInOutCubic = (value: number) =>
    value < 0.5 ? 4 * value * value * value : 1 - (-2 * value + 2) ** 3 / 2;

const normalizeCartMutations = (
    mutations: readonly TCartMutation[],
): readonly TCartMutation[] => {
    const mutationMap = new Map<number, number>();

    for (const mutation of mutations) {
        mutationMap.set(
            mutation.productId,
            (mutationMap.get(mutation.productId) ?? 0) + mutation.quantityDelta,
        );
    }

    return [...mutationMap.entries()]
        .map(([productId, quantityDelta]) => ({
            productId,
            quantityDelta,
        }))
        .filter((mutation) => mutation.quantityDelta !== 0);
};

const buildVisibleSearchResults = (
    products: readonly TCatalogProduct[],
    cartQuantities: Readonly<Record<number, number>>,
) =>
    products
        .filter(
            (
                product,
            ): product is TCatalogProduct & {
                readonly price: number;
            } => product.price !== null,
        )
        .map((product, index) => ({
            productId: product.id,
            title: product.title,
            subtitle: product.subtitle ?? null,
            price: product.price,
            quantityInCart: cartQuantities[product.id] ?? 0,
            rank: index + 1,
            primaryCategoryLabel: product.primaryCategoryLabel,
            normalizedName: normalizeSearchValue(
                `${product.title} ${product.subtitle}`,
            ),
        }));

const App = () => {
    const [selectedCategory, setSelectedCategory] = useState<string | null>(
        null,
    );
    const [searchText, setSearchText] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearchLoading, setIsSearchLoading] = useState(false);
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [visibleStartIndex, setVisibleStartIndex] = useState(0);
    const [cartQuantities, setCartQuantities] = useState<
        Record<number, number>
    >({});
    const [cartActivity, setCartActivity] = useState<Record<number, number>>(
        {},
    );
    const [cartIsPulsing, setCartIsPulsing] = useState(false);
    const [searchIsAnimating, setSearchIsAnimating] = useState(false);
    const [isCategoryNavCollapsed, setIsCategoryNavCollapsed] = useState(false);
    const [highlightedProductIds, setHighlightedProductIds] = useState<
        ReadonlySet<number>
    >(() => new Set());
    const [, setSpotlightProductId] = useState<number | null>(null);
    const [agentAction, setAgentAction] = useState<{
        readonly mode: TFauxCursorMode;
        readonly label: string;
    } | null>(null);
    const [activeUiTarget, setActiveUiTarget] = useState<string | null>(null);

    const selectedCategoryRef = useRef<string | null>(selectedCategory);
    const searchTextRef = useRef(searchText);
    const searchQueryRef = useRef(searchQuery);
    const isSearchLoadingRef = useRef(isSearchLoading);
    const visibleStartIndexRef = useRef(visibleStartIndex);
    const isCartOpenRef = useRef(isCartOpen);
    const cartQuantitiesRef = useRef(cartQuantities);
    const cartActivityRef = useRef(cartActivity);
    const cartActivityCounterRef = useRef(0);
    const highlightTimersRef = useRef<Map<number, number>>(new Map());
    const cartPulseTimerRef = useRef<number | null>(null);
    const searchCommitVersionRef = useRef(0);

    const searchInputRef = useRef<HTMLInputElement | null>(null);
    const searchPanelRef = useRef<HTMLDivElement | null>(null);
    const allCategoryButtonRef = useRef<HTMLButtonElement | null>(null);
    const categoryButtonRefs = useRef<Map<string, HTMLButtonElement>>(
        new Map(),
    );
    const productCardRefs = useRef<Map<number, HTMLElement>>(new Map());
    const gridSectionRef = useRef<HTMLElement | null>(null);
    const gridHeadingRef = useRef<HTMLDivElement | null>(null);
    const gridWindowNavRef = useRef<HTMLDivElement | null>(null);
    const previousWindowButtonRef = useRef<HTMLButtonElement | null>(null);
    const nextWindowButtonRef = useRef<HTMLButtonElement | null>(null);
    const cartPanelRef = useRef<HTMLElement | null>(null);
    const cartLineRefs = useRef<Map<number, HTMLElement>>(new Map());
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
        searchQueryRef.current = searchQuery;
    }, [searchQuery]);

    useEffect(() => {
        isSearchLoadingRef.current = isSearchLoading;
    }, [isSearchLoading]);

    useEffect(() => {
        visibleStartIndexRef.current = visibleStartIndex;
    }, [visibleStartIndex]);

    useEffect(() => {
        isCartOpenRef.current = isCartOpen;
    }, [isCartOpen]);

    useEffect(() => {
        cartQuantitiesRef.current = cartQuantities;
    }, [cartQuantities]);

    useEffect(() => {
        cartActivityRef.current = cartActivity;
    }, [cartActivity]);

    const {
        data: catalog = null,
        error: catalogError,
        isPending: isCatalogLoading,
    } = useQuery(catalogQueryOptions());
    const loadError = catalogError
        ? catalogError instanceof Error
            ? catalogError.message
            : String(catalogError)
        : null;

    const syncCategoryNavVisibility = useEffectEvent(() => {
        const gridTop =
            gridSectionRef.current?.getBoundingClientRect().top ??
            Number.POSITIVE_INFINITY;
        const nextCollapsed = gridTop <= 160;

        setIsCategoryNavCollapsed((current) =>
            current === nextCollapsed ? current : nextCollapsed,
        );
    });

    useEffect(() => {
        let frame = 0;

        const schedule = () => {
            if (frame !== 0) {
                return;
            }

            frame = window.requestAnimationFrame(() => {
                frame = 0;
                syncCategoryNavVisibility();
            });
        };

        schedule();
        window.addEventListener('scroll', schedule, {passive: true});
        window.addEventListener('resize', schedule);

        return () => {
            if (frame !== 0) {
                window.cancelAnimationFrame(frame);
            }

            window.removeEventListener('scroll', schedule);
            window.removeEventListener('resize', schedule);
        };
    }, []);

    useEffect(() => {
        const normalizedDraft = normalizeSearchValue(searchText);
        const normalizedQuery = normalizeSearchValue(searchQuery);

        if (normalizedDraft === normalizedQuery) {
            setIsSearchLoading(false);
            return;
        }

        const requestVersion = searchCommitVersionRef.current + 1;
        searchCommitVersionRef.current = requestVersion;
        setIsSearchLoading(true);
        const startedAt = performance.now();

        let cancelled = false;
        let loadingTimer = 0;
        const debounceTimer = window.setTimeout(() => {
            const remainingDelay = Math.max(
                0,
                SEARCH_LOADING_MIN_MS - (performance.now() - startedAt),
            );

            const commit = () => {
                if (
                    cancelled ||
                    searchCommitVersionRef.current !== requestVersion
                ) {
                    return;
                }

                searchQueryRef.current = searchText;
                visibleStartIndexRef.current = 0;
                startTransition(() => {
                    setSearchQuery(searchText);
                    setVisibleStartIndex(0);
                    setIsSearchLoading(false);
                });
            };

            if (remainingDelay > 0) {
                loadingTimer = window.setTimeout(commit, remainingDelay);
                return;
            }

            commit();
        }, SEARCH_INPUT_DEBOUNCE_MS);

        return () => {
            cancelled = true;
            window.clearTimeout(debounceTimer);
            if (loadingTimer !== 0) {
                window.clearTimeout(loadingTimer);
            }
        };
    }, [searchQuery, searchText]);

    useEffect(() => {
        const frame = window.requestAnimationFrame(() => {
            syncCategoryNavVisibility();
        });

        return () => {
            window.cancelAnimationFrame(frame);
        };
    }, [catalog, isCartOpen]);

    useEffect(
        () => () => {
            for (const timer of highlightTimersRef.current.values()) {
                window.clearTimeout(timer);
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

    const featuredCategories = useMemo<readonly TCatalogBrowserCategory[]>(
        () =>
            (catalog?.categories ?? []).slice(0, 10).map((category) => ({
                key: category.key,
                label: category.label,
                count: category.count,
            })),
        [catalog],
    );

    const filteredProducts = useMemo(
        () => getFilteredProducts(catalog, selectedCategory, searchQuery),
        [catalog, searchQuery, selectedCategory],
    );

    useEffect(() => {
        const nextStart = clampWindowStart(
            visibleStartIndex,
            filteredProducts.length,
        );
        if (nextStart !== visibleStartIndex) {
            visibleStartIndexRef.current = nextStart;
            startTransition(() => {
                setVisibleStartIndex(nextStart);
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

    const cartLines = useMemo(
        () =>
            catalog
                ? buildCartLines(
                      catalog.productMap,
                      cartQuantities,
                      cartActivity,
                  )
                : [],
        [catalog, cartActivity, cartQuantities],
    );

    const cartSummary = useMemo<TCartSummary>(
        () => summarizeCartLines(cartLines),
        [cartLines],
    );

    const featuredCategorySummary = useMemo(
        () =>
            featuredCategories.length > 0
                ? featuredCategories
                      .map((category) => `${category.key}: ${category.label}`)
                      .join(' | ')
                : 'none',
        [featuredCategories],
    );

    const visibleSearchResults = useMemo(
        () => buildVisibleSearchResults(visibleProducts, cartQuantities),
        [cartQuantities, visibleProducts],
    );

    const catalogWindowSummary = useMemo(() => {
        if (isSearchLoading) {
            const pendingQuery = searchText.trim() || 'all products';
            return `search loading for "${pendingQuery}" — wait`;
        }

        if (catalogWindow.totalMatches === 0) {
            return '0 results';
        }

        return `${catalogWindow.visibleFrom}-${catalogWindow.visibleTo} of ${catalogWindow.totalMatches}; previous ${catalogWindow.canScrollPrevious ? 'yes' : 'no'}; next ${catalogWindow.canScrollNext ? 'yes' : 'no'}`;
    }, [catalogWindow, isSearchLoading, searchText]);

    const searchStatusSummary = useMemo(
        () => {
            const draftQuery = searchText.trim() || 'all products';
            const settledQuery = searchQuery.trim() || 'all products';
            const categoryKey = selectedCategory ?? 'all';

            return isSearchLoading
                ? `loading: draft_query="${draftQuery}"; settled_query="${settledQuery}"; category_key="${categoryKey}"; visible_products and catalog_window still describe the settled shelf`
                : `idle: settled_query="${settledQuery}"; category_key="${categoryKey}"; visible_products and catalog_window describe this settled shelf`;
        },
        [isSearchLoading, searchQuery, searchText, selectedCategory],
    );

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
        ? (catalog?.categoryMap.get(selectedCategory)?.label ??
          'Selected aisle')
        : 'Products';

    const waitForUi = async (signal?: AbortSignal, delay = 120) => {
        await nextFrame(signal);
        await wait(delay, signal);
        await nextFrame(signal);
    };

    const waitForSearchToSettle = async (signal?: AbortSignal) => {
        while (
            isSearchLoadingRef.current ||
            normalizeSearchValue(searchTextRef.current) !==
                normalizeSearchValue(searchQueryRef.current)
        ) {
            await wait(SEARCH_SETTLE_POLL_MS, signal);
        }

        await waitForUi(signal, 60);
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
            targetTop =
                absoluteTop - window.innerHeight + rect.height + padding;
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
        await wait(120, signal);
        await nextFrame(signal);
    };

    const revealCatalogResults = async (signal?: AbortSignal) => {
        await revealElement(
            gridHeadingRef.current ?? gridSectionRef.current,
            'top',
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
        duration = 260,
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
                reject(
                    signal?.reason ?? new DOMException('Aborted', 'AbortError'),
                );
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
        await wait(80, signal);
        cursor.dataset.clicking = 'false';
    };

    const moveCursorToElement = async (
        element: Element | null,
        signal?: AbortSignal,
        duration = 220,
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

    const flashProducts = (productIds: readonly number[], duration = 1300) => {
        if (productIds.length === 0) {
            return;
        }

        setHighlightedProductIds((current) => {
            const next = new Set(current);
            for (const productId of productIds) {
                next.add(productId);
            }
            return next;
        });

        const spotlightId = productIds[productIds.length - 1];
        if (spotlightId !== undefined) {
            setSpotlightProductId(spotlightId);
        }

        for (const productId of productIds) {
            const existingTimer = highlightTimersRef.current.get(productId);
            if (existingTimer !== undefined) {
                window.clearTimeout(existingTimer);
            }

            const timer = window.setTimeout(() => {
                setHighlightedProductIds((current) => {
                    if (!current.has(productId)) {
                        return current;
                    }

                    const next = new Set(current);
                    next.delete(productId);
                    return next;
                });
                highlightTimersRef.current.delete(productId);
            }, duration);

            highlightTimersRef.current.set(productId, timer);
        }
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

    const getCategoryResult = (categoryKey: string | null, query: string) => ({
        selectedCategory: categoryKey,
        productCount: getFilteredProducts(catalog, categoryKey, query).length,
    });

    const applySearchValue = (nextValue: string) => {
        searchTextRef.current = nextValue;
        startTransition(() => {
            setSearchText(nextValue);
        });
    };

    const commitSearchQuery = async (
        nextQuery: string,
        signal?: AbortSignal,
    ): Promise<TAnimateSearchResult> => {
        const committedQuery = nextQuery.trim();
        applySearchValue(committedQuery);
        await waitForSearchToSettle(signal);

        const filteredMatches = getFilteredProducts(
            catalog,
            selectedCategoryRef.current,
            searchQueryRef.current,
        );
        const visibleResults = buildVisibleSearchResults(
            filteredMatches.slice(0, MAX_VISIBLE_PRODUCTS),
            cartQuantitiesRef.current,
        );
        const addableMatches = filteredMatches.filter(
            (product) => product.price !== null,
        );
        return {
            appliedQuery: searchQueryRef.current.trim(),
            resultCount: addableMatches.length,
            visibleResults,
        };
    };

    const applyCategorySelection = async (
        categoryKey: string | null,
        signal?: AbortSignal,
    ): Promise<TCategoryResult> => {
        const button =
            categoryKey === null
                ? allCategoryButtonRef.current
                : (categoryButtonRefs.current.get(categoryKey) ?? null);

        setActiveUiTarget(
            categoryKey === null ? 'category:all' : `category:${categoryKey}`,
        );
        setCursorMode(
            'browse',
            categoryKey === null ? 'show all aisles' : 'browse aisle',
        );
        await revealCategoryButton(button, signal);
        await moveCursorToElement(button, signal, 220);
        await pulseCursor(signal);

        selectedCategoryRef.current = categoryKey;
        visibleStartIndexRef.current = 0;
        startTransition(() => {
            setSelectedCategory(categoryKey);
            setVisibleStartIndex(0);
        });

        await waitForUi(signal, 80);

        return getCategoryResult(categoryKey, searchQueryRef.current);
    };

    const animateSearch = async (
        input: z.infer<typeof animateSearchInputSchema>,
        signal?: AbortSignal,
    ): Promise<TAnimateSearchResult> => {
        if (!catalog) {
            return {
                appliedQuery: '',
                resultCount: 0,
                visibleResults: [],
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
            setCursorMode('search', 'refine search');
            await scrollSearchAreaIntoView(signal);
            await moveCursorToElement(searchInputRef.current, signal, 160);
            searchInputRef.current?.focus();
            await pulseCursor(signal);

            let draft = searchTextRef.current;
            while (draft.length > 0) {
                draft = draft.slice(0, -1);
                applySearchValue(draft);
                await wait(Math.max(4, SEARCH_TYPING_BASE_MS - 2), signal);
            }

            draft = '';
            for (const character of input.query) {
                draft += character;
                applySearchValue(draft);
                await wait(SEARCH_TYPING_BASE_MS, signal);
            }

            const result = await commitSearchQuery(draft, signal);
            const leadingVisibleResult = result.visibleResults[0] ?? null;
            if (leadingVisibleResult) {
                await revealCatalogResults(signal);
                await revealElement(
                    productCardRefs.current.get(
                        leadingVisibleResult.productId,
                    ) ?? null,
                    'center',
                    signal,
                );
                flashProducts([leadingVisibleResult.productId], 1450);
            }

            return result;
        } finally {
            setSearchIsAnimating(false);
            hideCursor();
        }
    };

    const isProductInFirstWindow = (
        productId: number,
        categoryKey: string | null = selectedCategoryRef.current,
        query: string = searchQueryRef.current,
    ) =>
        getFilteredProducts(catalog, categoryKey, query)
            .slice(0, MAX_VISIBLE_PRODUCTS)
            .some((candidate) => candidate.id === productId);

    const ensureProductVisible = async (
        product: TCatalogProduct,
        signal?: AbortSignal,
    ) => {
        const revealFirstWindow = async () => {
            if (visibleStartIndexRef.current === 0) {
                await nextFrame(signal);
                return;
            }

            visibleStartIndexRef.current = 0;
            startTransition(() => {
                setVisibleStartIndex(0);
            });
            await waitForUi(signal, 80);
        };

        if (isProductInFirstWindow(product.id)) {
            await revealFirstWindow();
            return true;
        }

        const searchPlans = [
            {
                categoryKey: product.primaryCategoryKey ?? null,
                query: product.title,
            },
            {
                categoryKey: product.primaryCategoryKey ?? null,
                query: `${product.title} ${product.subtitle}`.trim(),
            },
            {
                categoryKey: null,
                query: product.title,
            },
            {
                categoryKey: null,
                query: `${product.title} ${product.subtitle}`.trim(),
            },
        ].filter(
            (plan, index, allPlans) =>
                allPlans.findIndex(
                    (candidate) =>
                        candidate.categoryKey === plan.categoryKey &&
                        candidate.query === plan.query,
                ) === index,
        );

        for (const plan of searchPlans) {
            await animateSearch(
                {
                    query: plan.query,
                    categoryKey: plan.categoryKey,
                },
                signal,
            );

            if (
                isProductInFirstWindow(product.id, plan.categoryKey, plan.query)
            ) {
                await revealFirstWindow();
                return true;
            }
        }

        return false;
    };

    const applyCartMutations = (mutations: readonly TCartMutation[]) => {
        if (!catalog) {
            return {
                summary: cartSummary,
                touchedProductIds: [] as readonly number[],
                addedProductIds: [] as readonly number[],
                removedProductIds: [] as readonly number[],
            };
        }

        const normalizedMutations = normalizeCartMutations(mutations);
        if (normalizedMutations.length === 0) {
            return {
                summary: cartSummary,
                touchedProductIds: [] as readonly number[],
                addedProductIds: [] as readonly number[],
                removedProductIds: [] as readonly number[],
            };
        }

        const mutationResult = mutateCartStateBatch(
            catalog.productMap,
            {
                quantities: cartQuantitiesRef.current,
                activity: cartActivityRef.current,
                activityCounter: cartActivityCounterRef.current,
            },
            normalizedMutations,
        );

        cartQuantitiesRef.current = mutationResult.state.quantities;
        cartActivityRef.current = mutationResult.state.activity;
        cartActivityCounterRef.current = mutationResult.state.activityCounter;
        setCartQuantities(mutationResult.state.quantities);
        setCartActivity(mutationResult.state.activity);

        if (mutationResult.addedProductIds.length > 0) {
            isCartOpenRef.current = true;
            setIsCartOpen(true);
        }

        if (mutationResult.touchedProductIds.length > 0) {
            flashProducts(mutationResult.touchedProductIds);
            pulseCartFab();
        }

        return {
            summary: mutationResult.summary,
            touchedProductIds: mutationResult.touchedProductIds,
            addedProductIds: mutationResult.addedProductIds,
            removedProductIds: mutationResult.removedProductIds,
        };
    };

    const performCartMutation = async (
        mutation: TCartMutation,
        signal?: AbortSignal,
    ) => {
        if (!catalog) {
            return {
                summary: cartSummary,
                touchedProductIds: [] as readonly number[],
            };
        }

        const product = catalog.productMap.get(mutation.productId);
        if (!product) {
            throw new Error(`Unknown product id: ${mutation.productId}`);
        }

        if (mutation.quantityDelta > 0 && product.price === null) {
            return {
                summary: cartSummary,
                touchedProductIds: [] as readonly number[],
            };
        }

        const quantityInCart = cartQuantitiesRef.current[product.id] ?? 0;

        try {
            if (quantityInCart > 0) {
                setActiveUiTarget(`cart:line:${product.id}`);
                setCursorMode(
                    'cart',
                    mutation.quantityDelta > 0
                        ? 'update basket'
                        : 'trim basket',
                );
                await revealCartLine(product.id, signal, {openIfNeeded: true});
                await moveCursorToElement(
                    cartLineRefs.current.get(product.id) ??
                        cartPanelRef.current,
                    signal,
                    180,
                );
                await pulseCursor(signal);

                const result = applyCartMutations([mutation]);
                await waitForUi(signal, 60);

                return {
                    summary: result.summary,
                    touchedProductIds: result.touchedProductIds,
                };
            }

            if (mutation.quantityDelta < 0) {
                return {
                    summary: cartSummary,
                    touchedProductIds: [] as readonly number[],
                };
            }

            await ensureProductVisible(product, signal);
            const productCard = productCardRefs.current.get(product.id) ?? null;

            if (productCard) {
                setActiveUiTarget(`product:${product.id}`);
                setCursorMode('cart', 'add from shelf');
                await revealElement(productCard, 'center', signal);
                await moveCursorToElement(productCard, signal, 200);
                await pulseCursor(signal);
            }

            const result = applyCartMutations([mutation]);
            await waitForUi(signal, 60);

            if (result.addedProductIds.length > 0) {
                setActiveUiTarget(`cart:line:${product.id}`);
                setCursorMode('cart', 'review basket');
                await revealCartLine(product.id, signal, {openIfNeeded: true});
                await moveCursorToElement(
                    cartLineRefs.current.get(product.id) ??
                        cartPanelRef.current,
                    signal,
                    160,
                );
            }

            return {
                summary: result.summary,
                touchedProductIds: result.touchedProductIds,
            };
        } finally {
            hideCursor();
        }
    };

    const runCartMutation = async (
        input: z.infer<typeof cartInputSchema>,
        signal?: AbortSignal,
    ): Promise<TCartResult> => {
        const result = await performCartMutation(input, signal);

        return {
            totalItems: result.summary.totalItems,
            subtotal: result.summary.subtotal,
        };
    };

    const scrollCatalogWindow = async (
        input: z.infer<typeof scrollCatalogInputSchema>,
        signal?: AbortSignal,
    ): Promise<TCatalogWindow> => {
        if (!catalog) {
            return buildCatalogWindow([], 0);
        }

        await waitForSearchToSettle(signal);

        try {
            const pageCount = Math.max(1, input.pages ?? 1);
            let currentStart = visibleStartIndexRef.current;
            let currentFiltered = getFilteredProducts(
                catalog,
                selectedCategoryRef.current,
                searchQueryRef.current,
            );

            for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
                const nextStart = clampWindowStart(
                    currentStart +
                        (input.direction === 'next'
                            ? MAX_VISIBLE_PRODUCTS
                            : -MAX_VISIBLE_PRODUCTS),
                    currentFiltered.length,
                );

                if (nextStart === currentStart) {
                    break;
                }

                setActiveUiTarget(`window:${input.direction}`);
                setCursorMode(
                    'browse',
                    input.direction === 'next'
                        ? 'next results'
                        : 'previous results',
                );
                await revealElement(
                    gridWindowNavRef.current ?? gridSectionRef.current,
                    'bottom',
                    signal,
                );
                await moveCursorToElement(
                    input.direction === 'next'
                        ? nextWindowButtonRef.current ??
                              gridWindowNavRef.current ??
                              gridSectionRef.current
                        : previousWindowButtonRef.current ??
                              gridWindowNavRef.current ??
                              gridSectionRef.current,
                    signal,
                    220,
                );
                await pulseCursor(signal);

                currentStart = nextStart;
                visibleStartIndexRef.current = nextStart;
                startTransition(() => {
                    setVisibleStartIndex(nextStart);
                });

                await waitForUi(signal, 90);
                await revealCatalogResults(signal);

                currentFiltered = getFilteredProducts(
                    catalog,
                    selectedCategoryRef.current,
                    searchQueryRef.current,
                );
            }

            return buildCatalogWindow(currentFiltered, currentStart);
        } finally {
            hideCursor();
        }
    };

    const handleSearchChange = (nextValue: string) => {
        applySearchValue(nextValue);
    };

    const handleSelectAllAisles = () => {
        selectedCategoryRef.current = null;
        visibleStartIndexRef.current = 0;
        startTransition(() => {
            setSelectedCategory(null);
            setVisibleStartIndex(0);
        });
    };

    const handleSelectCategory = (categoryKey: string) => {
        selectedCategoryRef.current = categoryKey;
        visibleStartIndexRef.current = 0;
        startTransition(() => {
            setSelectedCategory(categoryKey);
            setVisibleStartIndex(0);
        });
    };

    const handleProductCardAdjust = (productId: number, delta: number) => {
        const result = applyCartMutations([{productId, quantityDelta: delta}]);
        if (delta > 0 && result.addedProductIds.length > 0) {
            void revealCartLine(productId, undefined, {openIfNeeded: true});
        }
    };

    const handleCartAdjust = (productId: number, delta: number) => {
        applyCartMutations([{productId, quantityDelta: delta}]);
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
            await waitForUi(undefined, 120);
            await revealCatalogResults(undefined);
        })();
    };

    const goToPreviousPage = () => {
        runManualPageChange('previous');
    };

    const goToNextPage = () => {
        runManualPageChange('next');
    };

    const toggleCart = () => {
        isCartOpenRef.current = !isCartOpenRef.current;
        setIsCartOpen((current) => !current);
    };

    const closeCart = () => {
        isCartOpenRef.current = false;
        setIsCartOpen(false);
    };

    const registerSearchPanelRef = (node: HTMLDivElement | null) => {
        searchPanelRef.current = node;
    };

    const registerSearchInputRef = (node: HTMLInputElement | null) => {
        searchInputRef.current = node;
    };

    const registerAllCategoryButtonRef = (node: HTMLButtonElement | null) => {
        allCategoryButtonRef.current = node;
    };

    const registerCategoryButtonRef = (
        categoryKey: string,
        node: HTMLButtonElement | null,
    ) => {
        if (node) {
            categoryButtonRefs.current.set(categoryKey, node);
        } else {
            categoryButtonRefs.current.delete(categoryKey);
        }
    };

    const registerGridSectionRef = (node: HTMLElement | null) => {
        gridSectionRef.current = node;
    };

    const registerGridHeadingRef = (node: HTMLDivElement | null) => {
        gridHeadingRef.current = node;
    };

    const registerGridWindowNavRef = (node: HTMLDivElement | null) => {
        gridWindowNavRef.current = node;
    };

    const registerPreviousWindowButtonRef = (
        node: HTMLButtonElement | null,
    ) => {
        previousWindowButtonRef.current = node;
    };

    const registerNextWindowButtonRef = (node: HTMLButtonElement | null) => {
        nextWindowButtonRef.current = node;
    };

    const registerProductCardRef = (
        productId: number,
        node: HTMLElement | null,
    ) => {
        if (node) {
            productCardRefs.current.set(productId, node);
        } else {
            productCardRefs.current.delete(productId);
        }
    };

    const registerCartPanelRef = (node: HTMLElement | null) => {
        cartPanelRef.current = node;
    };

    const registerCartLineRef = (
        productId: number,
        node: HTMLElement | null,
    ) => {
        if (node) {
            cartLineRefs.current.set(productId, node);
        } else {
            cartLineRefs.current.delete(productId);
        }
    };

    const activeBrowserTarget =
        activeUiTarget === null || activeUiTarget.startsWith('cart:')
            ? null
            : activeUiTarget;
    const showCategoryNav =
        !isCategoryNavCollapsed ||
        (activeBrowserTarget?.startsWith('category:') ?? false);

    const activeCartProductId = activeUiTarget?.startsWith('cart:line:')
        ? Number(activeUiTarget.slice('cart:line:'.length))
        : null;

    useAgentVariable('search_status', {
        schema: searchStatusSchema,
        value: searchStatusSummary,
    });

    useAgentVariable('featured_categories', {
        schema: featuredCategorySchema,
        value: featuredCategorySummary,
    });

    useAgentVariable('visible_products', {
        schema: visibleProductCardSchema,
        value: visibleSearchResults,
    });

    useAgentVariable('catalog_window', {
        schema: catalogWindowSummarySchema,
        value: catalogWindowSummary,
    });

    useAgentVariable('cart_summary', {
        schema: cartSummarySchema,
        value: cartSummaryText,
    });

    useAgentFunction('animateSearch', {
        inputSchema: animateSearchInputSchema,
        outputSchema: animateSearchOutputSchema,
        mutationTimeoutMs: AGENT_MUTATION_TIMEOUT_MS,
        mutates: ['search_status', 'visible_products', 'catalog_window'],
        func: animateSearch,
    });

    useAgentFunction('setCategory', {
        inputSchema: categorySelectionSchema,
        outputSchema: categorySelectionOutputSchema,
        mutationTimeoutMs: AGENT_MUTATION_TIMEOUT_MS,
        mutates: ['search_status', 'visible_products', 'catalog_window'],
        func: async (
            input: z.infer<typeof categorySelectionSchema>,
            signal?: AbortSignal,
        ) => {
            try {
                return await applyCategorySelection(input.categoryKey, signal);
            } finally {
                hideCursor();
            }
        },
    });

    useAgentFunction('updateCart', {
        inputSchema: cartInputSchema,
        outputSchema: cartOutputSchema,
        mutationTimeoutMs: AGENT_MUTATION_TIMEOUT_MS,
        mutates: ['cart_summary', 'visible_products'],
        func: async (
            input: z.infer<typeof cartInputSchema>,
            signal?: AbortSignal,
        ) => await runCartMutation(input, signal),
    });

    useAgentFunction('scrollCatalog', {
        inputSchema: scrollCatalogInputSchema,
        outputSchema: catalogWindowSchema,
        mutationTimeoutMs: AGENT_MUTATION_TIMEOUT_MS,
        mutates: ['visible_products', 'catalog_window'],
        func: scrollCatalogWindow,
    });

    return (
        <>
            <SystemPrompt>{systemPrompt}</SystemPrompt>

            <div className="grocery-app-shell min-h-screen bg-[#fbfcfa] px-5 pb-20 pt-5 text-[var(--g-ink)] max-[760px]:px-[0.9rem] max-[760px]:pb-[7.5rem]">
                <div
                    className="fixed left-4 top-4 z-[65] grid min-w-[12rem] max-w-[min(22rem,calc(100vw-2rem))] gap-[0.28rem] overflow-hidden rounded-[1.2rem] border border-[var(--g-border)] bg-[rgba(255,255,253,0.97)] px-4 py-[0.82rem] shadow-[0_18px_38px_rgba(31,73,55,0.1),inset_0_1px_rgba(255,255,255,0.92)] opacity-0 backdrop-blur-[16px] transition-[opacity,transform,border-color,box-shadow] duration-[220ms] ease-out -translate-y-2 pointer-events-none data-[visible=true]:translate-y-0 data-[visible=true]:opacity-100 data-[visible=true]:animate-[grocery-agent-status-pulse_1.8s_ease-out_infinite] data-[mode=search]:border-[var(--g-accent-soft)] data-[mode=search]:shadow-[0_22px_44px_rgba(47,122,86,0.14),inset_0_1px_rgba(255,255,255,0.92)] data-[mode=cart]:border-[var(--g-citrus-soft)] data-[mode=cart]:shadow-[0_22px_44px_rgba(216,161,63,0.12),inset_0_1px_rgba(255,255,255,0.92)] max-[760px]:left-[0.9rem] max-[760px]:right-[0.9rem] max-[760px]:top-[5.4rem] max-[760px]:max-w-none"
                    data-visible={agentAction ? 'true' : 'false'}
                    data-mode={agentAction?.mode ?? 'browse'}
                    aria-live="polite">
                    <span className="inline-flex items-center gap-[0.42rem] text-[0.7rem] font-bold uppercase tracking-[0.16em] text-[var(--g-ink-muted)]">
                        <i
                            aria-hidden="true"
                            className="h-[0.58rem] w-[0.58rem] rounded-full bg-[var(--g-accent)]"
                        />
                        Assistant action
                    </span>
                    <strong className="text-[0.98rem] leading-[1.3] text-[var(--g-ink)]">
                        {agentAction?.label ?? 'Idle'}
                    </strong>
                </div>

                <header className="relative z-[1] mx-auto mb-4 flex max-w-[1380px] min-w-0 items-start justify-between gap-4 max-[760px]:flex-col max-[760px]:items-start">
                    <div className="grid min-w-0 gap-[0.45rem]">
                        <h1 className="font-[var(--font-display)] text-[clamp(2.1rem,3vw,3rem)] font-semibold leading-[0.96] tracking-[-0.03em]">
                            Atelier Basket
                        </h1>
                    </div>
                </header>

                {loadError ? (
                    <main className="relative z-[1] mx-auto mt-24 grid max-w-[42rem] min-w-0 place-items-center gap-[0.45rem] px-[1.1rem] py-[2.25rem] text-center">
                        <p className="inline-flex items-center gap-[0.45rem] text-[0.74rem] font-bold uppercase tracking-[0.22em] text-[var(--g-ink-muted)]">
                            Catalog unavailable
                        </p>
                        <h2 className="max-w-[18ch] font-[var(--font-display)] text-[clamp(2.5rem,7vw,4rem)] font-semibold leading-[0.96] tracking-[-0.03em]">
                            {loadError}
                        </h2>
                    </main>
                ) : (
                    <main className="relative z-[1] mx-auto max-w-[1380px] min-w-0">
                        <div
                            className="grocery-main-layout block px-[clamp(3rem,4vw,4.75rem)] transition-[padding,max-width] duration-[280ms] ease-out data-[cart-open=true]:pl-[clamp(3.25rem,4.6vw,4.75rem)] data-[cart-open=true]:pr-[clamp(20rem,22vw,22.5rem)] max-[1320px]:data-[cart-open=true]:pr-[clamp(18rem,21vw,20rem)] max-[980px]:px-0 max-[980px]:data-[cart-open=true]:px-0"
                            data-cart-open={isCartOpen ? 'true' : 'false'}>
                            <CatalogBrowser
                                searchDraft={searchText}
                                searchIsAnimating={searchIsAnimating}
                                loadingState={
                                    isCatalogLoading
                                        ? 'catalog'
                                        : isSearchLoading
                                          ? 'search'
                                          : 'idle'
                                }
                                searchAppliedQuery={searchQuery}
                                activeUiTarget={activeBrowserTarget}
                                showCategoryNav={showCategoryNav}
                                selectedCategory={selectedCategory}
                                selectedCategoryLabel={selectedCategoryLabel}
                                featuredCategories={featuredCategories}
                                visibleProducts={visibleProducts}
                                catalogWindow={catalogWindow}
                                cartQuantities={cartQuantities}
                                highlightedProductIds={highlightedProductIds}
                                registerSearchPanelRef={registerSearchPanelRef}
                                registerSearchInputRef={registerSearchInputRef}
                                registerAllCategoryButtonRef={
                                    registerAllCategoryButtonRef
                                }
                                registerCategoryButtonRef={
                                    registerCategoryButtonRef
                                }
                                registerGridSectionRef={registerGridSectionRef}
                                registerGridHeadingRef={registerGridHeadingRef}
                                registerGridWindowNavRef={
                                    registerGridWindowNavRef
                                }
                                registerPreviousWindowButtonRef={
                                    registerPreviousWindowButtonRef
                                }
                                registerNextWindowButtonRef={
                                    registerNextWindowButtonRef
                                }
                                registerProductCardRef={registerProductCardRef}
                                onSearchDraftChange={handleSearchChange}
                                onSelectAllAisles={handleSelectAllAisles}
                                onSelectCategory={handleSelectCategory}
                                onAdjustCart={handleProductCardAdjust}
                                onPreviousPage={goToPreviousPage}
                                onNextPage={goToNextPage}
                            />

                            {catalog ? (
                                <CartPanel
                                    isOpen={isCartOpen}
                                    isPulsing={cartIsPulsing}
                                    cartLines={cartLines}
                                    totalItems={cartSummary.totalItems}
                                    subtotal={cartSummary.subtotal}
                                    activeProductId={activeCartProductId}
                                    isAgentActive={
                                        activeUiTarget?.startsWith('cart:') ??
                                        false
                                    }
                                    registerPanelRef={registerCartPanelRef}
                                    registerLineRef={registerCartLineRef}
                                    onAdjustCart={handleCartAdjust}
                                    onToggle={toggleCart}
                                    onClose={closeCart}
                                />
                            ) : null}
                        </div>
                    </main>
                )}

                <FauxCursor ref={cursorRef} labelRef={cursorLabelRef} />
            </div>

            <PageUseChat
                title="ATELIER MARKET GUIDE"
                greeting="Ask for ingredients, Bangladeshi staples, better product matches, or exact items to add to cart."
                placeholder="Ask for recipe ingredients, compare brands, browse aisles, or add exact items to cart"
                suggestions={[
                    "I'm making fried chicken tonight.",
                    'Add Greek yogurt, granola, and blueberries.',
                    'Find a good salted butter and add it.',
                ]}
                theme="light"
                roundedness="lg"
                expandedPlacement="bottom-left"
                cssVariables={chatTheme}
                devMode
            />
        </>
    );
};

export default App;
