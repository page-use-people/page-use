import {
    normalizeCatalog,
    normalizeSearchValue,
    type TCatalogData,
    type TCatalogProduct,
    type TRawProductsPayload,
} from './catalog.ts';

export const MAX_VISIBLE_PRODUCTS = 24;
export const SEARCH_TYPING_BASE_MS = 56;

export type TAnimateSearchResult = {
    readonly resultCount: number;
    readonly leadingResultId: number | null;
    readonly leadingResultTitle: string | null;
};

export type TCategoryResult = {
    readonly selectedCategory: string | null;
    readonly productCount: number;
};

export type TCatalogWindow = {
    readonly visibleFrom: number;
    readonly visibleTo: number;
    readonly visibleCount: number;
    readonly totalMatches: number;
    readonly canScrollNext: boolean;
    readonly canScrollPrevious: boolean;
};

const boundedLevenshtein = (
    left: string,
    right: string,
    maxDistance: number,
): number | null => {
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

const subsequenceScore = (needle: string, haystack: string): number | null => {
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

const scoreTokenMatch = (
    queryToken: string,
    candidateToken: string,
): number | null => {
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

export const scoreSearchMatch = (
    product: TCatalogProduct,
    selectedCategory: string | null,
    normalizedQuery: string,
): number | null => {
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

export const getFilteredProducts = (
    catalog: TCatalogData | null,
    selectedCategory: string | null,
    query: string,
): TCatalogProduct[] => {
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

export const clampWindowStart = (start: number, totalMatches: number): number =>
    Math.max(0, Math.min(start, Math.max(0, totalMatches - MAX_VISIBLE_PRODUCTS)));

export const buildCatalogWindow = (
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

export const loadCatalog = async (): Promise<TCatalogData> => {
    const [productsResponse, palettesResponse] = await Promise.all([
        fetch('/data/products.json'),
        fetch('/data/image-palettes.json'),
    ]);

    if (!productsResponse.ok || !palettesResponse.ok) {
        throw new Error('Failed to load local grocery demo data.');
    }

    const [productsPayload, palettes] = await Promise.all([
        productsResponse.json() as Promise<TRawProductsPayload>,
        palettesResponse.json() as Promise<readonly (readonly (string | null)[])[]>,
    ]);

    return normalizeCatalog(productsPayload, palettes);
};
