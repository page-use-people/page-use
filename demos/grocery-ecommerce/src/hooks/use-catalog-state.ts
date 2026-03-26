import {startTransition, useEffect, useMemo} from 'react';
import {useQuery} from '@tanstack/react-query';
import {normalizeSearchValue, type TCatalogProduct} from '../lib/catalog.ts';
import {
    MAX_VISIBLE_PRODUCTS,
    buildCatalogWindow,
    catalogQueryOptions,
    clampWindowStart,
    getFilteredProducts,
} from '../lib/catalog-browser.ts';
import {useLatestState} from './use-latest-state.ts';
import {useSearchDebounce} from './use-search-debounce.ts';
import {wait} from '../lib/catalog.ts';
import {waitForUi} from '../lib/async-animation.ts';

export type TCatalogBrowserCategory = {
    readonly key: string;
    readonly label: string;
    readonly count: number;
};

const SEARCH_SETTLE_POLL_MS = 24;

export const buildVisibleSearchResults = (
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

export const useCatalogState = () => {
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

    const [selectedCategory, setSelectedCategory, selectedCategoryRef] =
        useLatestState<string | null>(null);
    const [searchText, setSearchText, searchTextRef] = useLatestState('');
    const [searchQuery, setSearchQuery, searchQueryRef] = useLatestState('');
    const [isSearchLoading, setIsSearchLoading, isSearchLoadingRef] =
        useLatestState(false);
    const [visibleStartIndex, setVisibleStartIndex, visibleStartIndexRef] =
        useLatestState(0);
    const [searchIsAnimating, setSearchIsAnimating] = useLatestState(false);

    useSearchDebounce(
        searchText,
        searchQuery,
        setSearchQuery,
        setVisibleStartIndex,
        setIsSearchLoading,
    );

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
            startTransition(() => {
                setVisibleStartIndex(nextStart);
            });
        }
    }, [filteredProducts.length, visibleStartIndex, setVisibleStartIndex]);

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

    const selectedCategoryLabel = selectedCategory
        ? (catalog?.categoryMap.get(selectedCategory)?.label ??
          'Selected aisle')
        : 'Products';

    const applySearchValue = (nextValue: string) => {
        setSearchText(nextValue);
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

    const selectCategory = (categoryKey: string | null) => {
        setSelectedCategory(categoryKey);
        setVisibleStartIndex(0);
    };

    const getCategoryResult = (
        categoryKey: string | null,
        query: string,
    ) => ({
        selectedCategory: categoryKey,
        productCount: getFilteredProducts(catalog, categoryKey, query).length,
    });

    const isProductInFirstWindow = (
        productId: number,
        categoryKey: string | null = selectedCategoryRef.current,
        query: string = searchQueryRef.current,
    ) =>
        getFilteredProducts(catalog, categoryKey, query)
            .slice(0, MAX_VISIBLE_PRODUCTS)
            .some((candidate) => candidate.id === productId);

    const goToPage = (direction: 'next' | 'previous') => {
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

        setVisibleStartIndex(nextStart);
    };

    return {
        catalog,
        loadError,
        isCatalogLoading,
        selectedCategory,
        searchText,
        searchQuery,
        isSearchLoading,
        visibleStartIndex,
        searchIsAnimating,
        filteredProducts,
        visibleProducts,
        catalogWindow,
        featuredCategories,
        selectedCategoryLabel,

        selectedCategoryRef,
        searchTextRef,
        searchQueryRef,
        isSearchLoadingRef,
        visibleStartIndexRef,

        applySearchValue,
        selectCategory,
        getCategoryResult,
        isProductInFirstWindow,
        goToPage,
        setVisibleStartIndex,
        setSearchIsAnimating,
        waitForSearchToSettle,
    } as const;
};

export type TCatalogState = ReturnType<typeof useCatalogState>;
