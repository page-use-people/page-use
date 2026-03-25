import {
    startTransition,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import {PageUseChat} from '@page-use/react/ui/chat';
import {SystemPrompt, useAgentFunction, useAgentVariable, z} from '@page-use/react';
import {
    CatalogBrowser,
    type TCatalogBrowserCategory,
} from './components/CatalogBrowser.tsx';
import {CartPanel} from './components/CartPanel.tsx';
import {FauxCursor} from './components/FauxCursor.tsx';
import {ProductModal} from './components/ProductModal.tsx';
import {
    normalizeSearchValue,
    wait,
    type TCatalogData,
    type TCatalogProduct,
} from './lib/catalog.ts';
import {
    MAX_VISIBLE_PRODUCTS,
    SEARCH_TYPING_BASE_MS,
    buildCatalogWindow,
    clampWindowStart,
    getFilteredProducts,
    loadCatalog,
    scoreSearchMatch,
    type TAnimateSearchResult,
    type TCatalogWindow,
    type TCategoryResult,
} from './lib/catalog-browser.ts';
import {
    buildCartLines,
    mutateCartState,
    summarizeCartLines,
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
    nullableSpotlightSchema,
    scrollCatalogInputSchema,
    spotlightInputSchema,
    spotlightOutputSchema,
    systemPrompt,
    visibleProductCardSchema,
    type TCartResult,
    type TSpotlightResult,
} from './lib/assistant.ts';

type TFauxCursorMode = 'browse' | 'search' | 'cart';
type TRevealPlacement = 'top' | 'center' | 'bottom';

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

    const cartLines = useMemo(
        () =>
            catalog
                ? buildCartLines(catalog.productMap, cartQuantities, cartActivity)
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
        if (!catalog) {
            return cartSummary;
        }

        const mutationResult = mutateCartState(
            catalog.productMap,
            {
                quantities: cartQuantitiesRef.current,
                activity: cartActivityRef.current,
                activityCounter: cartActivityCounterRef.current,
            },
            productId,
            quantityDelta,
        );

        cartQuantitiesRef.current = mutationResult.state.quantities;
        cartActivityRef.current = mutationResult.state.activity;
        cartActivityCounterRef.current = mutationResult.state.activityCounter;
        setCartQuantities(mutationResult.state.quantities);
        setCartActivity(mutationResult.state.activity);
        if (quantityDelta > 0) {
            isCartOpenRef.current = true;
            setIsCartOpen(true);
        }
        pulseCartFab();

        return mutationResult.summary;
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

    const handleSearchDraftChange = (nextValue: string) => {
        searchDraftRef.current = nextValue;
        startTransition(() => {
            setSearchDraft(nextValue);
        });
    };

    const handleSelectAllAisles = () => {
        startTransition(() => {
            setSelectedCategory(null);
        });
    };

    const handleSelectCategory = (categoryKey: string) => {
        startTransition(() => {
            setSelectedCategory(categoryKey);
        });
    };

    const closeModal = () => {
        modalProductIdRef.current = null;
        setModalProductId(null);
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

    const registerSearchSubmitButtonRef = (node: HTMLButtonElement | null) => {
        searchSubmitButtonRef.current = node;
    };

    const registerSearchClearButtonRef = (node: HTMLButtonElement | null) => {
        searchClearButtonRef.current = node;
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

    const registerPreviousWindowButtonRef = (node: HTMLButtonElement | null) => {
        previousWindowButtonRef.current = node;
    };

    const registerNextWindowButtonRef = (node: HTMLButtonElement | null) => {
        nextWindowButtonRef.current = node;
    };

    const registerProductCardRef = (productId: number, node: HTMLElement | null) => {
        if (node) {
            productCardRefs.current.set(productId, node);
        } else {
            productCardRefs.current.delete(productId);
        }
    };

    const registerCartPanelRef = (node: HTMLElement | null) => {
        cartPanelRef.current = node;
    };

    const registerCartLineRef = (productId: number, node: HTMLElement | null) => {
        if (node) {
            cartLineRefs.current.set(productId, node);
        } else {
            cartLineRefs.current.delete(productId);
        }
    };

    const registerModalAddButtonRef = (node: HTMLButtonElement | null) => {
        modalAddButtonRef.current = node;
    };

    const activeBrowserTarget =
        activeUiTarget === null ||
        activeUiTarget === 'modal:add' ||
        activeUiTarget.startsWith('cart:')
            ? null
            : activeUiTarget;

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
                            <CatalogBrowser
                                searchDraft={searchDraft}
                                searchIsAnimating={searchIsAnimating}
                                activeUiTarget={activeBrowserTarget}
                                selectedCategory={selectedCategory}
                                selectedCategoryLabel={selectedCategoryLabel}
                                featuredCategories={featuredCategories}
                                visibleProducts={visibleProducts}
                                catalogWindow={catalogWindow}
                                cartQuantities={cartQuantities}
                                highlightedProductId={highlightedProductId}
                                registerSearchPanelRef={registerSearchPanelRef}
                                registerSearchInputRef={registerSearchInputRef}
                                registerSearchSubmitButtonRef={
                                    registerSearchSubmitButtonRef
                                }
                                registerSearchClearButtonRef={registerSearchClearButtonRef}
                                registerAllCategoryButtonRef={registerAllCategoryButtonRef}
                                registerCategoryButtonRef={registerCategoryButtonRef}
                                registerGridSectionRef={registerGridSectionRef}
                                registerGridHeadingRef={registerGridHeadingRef}
                                registerGridWindowNavRef={registerGridWindowNavRef}
                                registerPreviousWindowButtonRef={
                                    registerPreviousWindowButtonRef
                                }
                                registerNextWindowButtonRef={registerNextWindowButtonRef}
                                registerProductCardRef={registerProductCardRef}
                                onSearchDraftChange={handleSearchDraftChange}
                                onSearchSubmit={runManualSearch}
                                onSearchClear={runManualClear}
                                onSelectAllAisles={handleSelectAllAisles}
                                onSelectCategory={handleSelectCategory}
                                onOpenProduct={openProductModal}
                                onPreviousPage={goToPreviousPage}
                                onNextPage={goToNextPage}
                            />

                            <CartPanel
                                isOpen={isCartOpen}
                                isPulsing={cartIsPulsing}
                                cartLines={cartLines}
                                totalItems={cartSummary.totalItems}
                                subtotal={cartSummary.subtotal}
                                activeProductId={activeCartProductId}
                                isAgentActive={activeUiTarget?.startsWith('cart:') ?? false}
                                registerPanelRef={registerCartPanelRef}
                                registerLineRef={registerCartLineRef}
                                onAdjustCart={mutateCart}
                                onOpenProduct={openProductModal}
                                onToggle={toggleCart}
                                onClose={closeCart}
                            />
                        </div>
                    </main>
                )}

                <ProductModal
                    product={modalProduct}
                    isAgentActive={activeUiTarget === 'modal:add'}
                    addButtonRef={registerModalAddButtonRef}
                    onBackdropClick={closeModal}
                    onClose={closeModal}
                    onAddToCart={() => {
                        if (modalProduct) {
                            runManualAddToCart(modalProduct.id);
                        }
                    }}
                />

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
