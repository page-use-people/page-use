import {z} from '@page-use/react';

export type TFeaturedCategory = {
    readonly key: string;
    readonly label: string;
    readonly count: number;
};

export type TCartSummary = {
    readonly totalItems: number;
    readonly subtotal: number | null;
    readonly lines: readonly TCartLineSummary[];
};

export type TCartLineSummary = {
    readonly productId: number;
    readonly title: string;
    readonly quantity: number;
    readonly price: number | null;
    readonly lineTotal: number | null;
    readonly imageUrl: string;
};

export type TAnimateSearchResult = {
    readonly appliedQuery: string;
    readonly resultCount: number;
    readonly visibleResults: TAnimateSearchVisibleResult[];
};

export type TAnimateSearchVisibleResult = {
    readonly productId: number;
    readonly title: string;
    readonly subtitle: string | null;
    readonly price: number;
    readonly quantityInCart: number;
    readonly rank: number;
    readonly primaryCategoryLabel: string | null;
    readonly normalizedName: string;
};

export type TCategoryResult = {
    readonly selectedCategory: string | null;
    readonly productCount: number;
};

export type TSpotlightResult = {
    readonly productId: number;
    readonly productTitle: string;
};

export type TCartResult = {
    readonly totalItems: number;
    readonly subtotal: number | null;
};

export type TCartBatchResult = {
    readonly totalItems: number;
    readonly subtotal: number | null;
    readonly touchedProductIds: number[];
};

export type TCatalogWindow = {
    readonly visibleFrom: number;
    readonly visibleTo: number;
    readonly visibleCount: number;
    readonly totalMatches: number;
    readonly canScrollNext: boolean;
    readonly canScrollPrevious: boolean;
};

export type TFauxCursorMode = 'browse' | 'search' | 'cart';
export type TRevealPlacement = 'top' | 'center' | 'bottom';

export const featuredCategorySchema = z
    .string()
    .describe('compact list of category keys available for browsing');

export const visibleProductCardSchema = z
    .array(
        z.object({
            productId: z.number().describe('visible product id'),
            title: z.string().describe('visible product title'),
            subtitle: z
                .string()
                .nullable()
                .describe('visible product subtitle if shown on the card'),
            price: z.number().describe('visible product price'),
            quantityInCart: z
                .number()
                .describe('current basket quantity for this product'),
            rank: z
                .number()
                .describe('1-based position in the settled visible result list'),
            primaryCategoryLabel: z
                .string()
                .nullable()
                .describe('primary category label for the visible product'),
            normalizedName: z
                .string()
                .describe('normalized searchable name for the visible product'),
        }),
    )
    .describe('structured settled visible products for the current shelf');

export const animateSearchVisibleResultSchema = z
    .array(
        z.object({
            productId: z.number().describe('visible product id'),
            title: z.string().describe('visible product title'),
            subtitle: z
                .string()
                .nullable()
                .describe('visible product subtitle if shown on the card'),
            price: z.number().describe('visible product price'),
            quantityInCart: z
                .number()
                .describe('current basket quantity for this product'),
            rank: z
                .number()
                .describe('1-based position in the settled visible result list'),
            primaryCategoryLabel: z
                .string()
                .nullable()
                .describe('primary category label for the visible product'),
            normalizedName: z
                .string()
                .describe('normalized searchable name for the visible product'),
        }),
    )
    .describe(
        'addable visible product cards after the search settles; this matches the settled visible_products data',
    );

export const searchStatusSchema = z
    .string()
    .describe(
        'search lifecycle status including draft_query, settled_query, and category_key; loading means visible_products and catalog_window still describe the settled shelf',
    );

export const cartSummarySchema = z
    .string()
    .describe('compact basket summary with item ids and quantities');

export const nullableSpotlightSchema = z
    .string()
    .nullable()
    .describe('compact summary of the currently highlighted product card');

export const catalogWindowSummarySchema = z
    .string()
    .describe('compact summary of the settled result window');

export const animateSearchInputSchema = z
    .object({
        query: z.string().describe('query to search for'),
        categoryKey: z
            .string()
            .nullable()
            .optional()
            .describe('optional category key to browse before searching'),
    })
    .describe('search the catalog for a product');

export const animateSearchOutputSchema = z
    .object({
        appliedQuery: z
            .string()
            .describe('query currently applied to the shelf after search settles'),
        resultCount: z.number().describe('number of matching products'),
        visibleResults: animateSearchVisibleResultSchema,
    })
    .describe('settled search results after the query is fully applied');

export const categorySelectionSchema = z
    .object({
        categoryKey: z
            .string()
            .nullable()
            .describe(
                'category key to browse, or null to clear category filtering',
            ),
    })
    .describe('change the active category filter');

export const categorySelectionOutputSchema = z
    .object({
        selectedCategory: z
            .string()
            .nullable()
            .describe('resulting category key'),
        productCount: z
            .number()
            .describe('count of matching products under the current filters'),
    })
    .describe('result of changing category');

export const spotlightInputSchema = z
    .object({
        productId: z.number().describe('product id to focus'),
    })
    .describe('focus a specific product card in the shelf');

export const spotlightOutputSchema = z
    .object({
        productId: z.number().describe('focused product id'),
        productTitle: z.string().describe('focused product title'),
    })
    .describe('product card now highlighted in the shelf');

export const cartInputSchema = z
    .object({
        productId: z.number().describe('product id to add or remove'),
        quantityDelta: z
            .number()
            .describe('positive to add, negative to remove'),
    })
    .describe('adjust the quantity of a product in the basket');

export const cartOutputSchema = z
    .object({
        totalItems: z.number().describe('total quantity after mutation'),
        subtotal: z
            .number()
            .nullable()
            .describe('basket subtotal when all prices are known'),
    })
    .describe('basket totals after the quantity change');

export const cartBatchInputSchema = z
    .object({
        mutations: z
            .array(
                z.object({
                    productId: z
                        .number()
                        .describe('product id to add or remove'),
                    quantityDelta: z
                        .number()
                        .describe('positive to add, negative to remove'),
                }),
            )
            .min(1)
            .max(12)
            .describe('cart changes to apply in one request'),
    })
    .describe('apply multiple basket changes in one request');

export const cartBatchOutputSchema = z
    .object({
        totalItems: z.number().describe('total quantity after all changes'),
        subtotal: z
            .number()
            .nullable()
            .describe('basket subtotal when all prices are known'),
        touchedProductIds: z
            .array(z.number())
            .describe('product ids whose basket quantities changed'),
    })
    .describe('basket totals after the batch of quantity changes');

export const catalogWindowSchema = z
    .object({
        visibleFrom: z
            .number()
            .describe(
                '1-based index of the first visible product in the filtered list',
            ),
        visibleTo: z
            .number()
            .describe(
                '1-based index of the last visible product in the filtered list',
            ),
        visibleCount: z
            .number()
            .describe('count of currently visible products'),
        totalMatches: z
            .number()
            .describe(
                'total products matching the current search and category',
            ),
        canScrollNext: z
            .boolean()
            .describe(
                'whether more matching products exist after the current page',
            ),
        canScrollPrevious: z
            .boolean()
            .describe(
                'whether earlier matching products exist before the current page',
            ),
    })
    .describe('information about the active page of search results');

export const scrollCatalogInputSchema = z
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

export const systemPrompt = `
        You are the concierge for a Bangladesh grocery storefront.

        You can read:
        - search_status: includes draft_query, settled_query, and category_key.
        - visible_products: structured JSON for the currently visible addable products.
        - catalog_window: the current page of the settled shelf.
        - featured_categories: compact key and label pairs for browsing.
        - cart_summary: what is already in the basket.

        You can act with:
        - animateSearch(query, categoryKey?)
        - setCategory(categoryKey | null)
        - scrollCatalog(direction, pages?)
        - updateCart(productId, quantityDelta)

        Rules:
        - When search_status is loading, visible_products and catalog_window still describe the settled_query and category_key, not the newer draft_query.
        - When search_status is idle, visible_products and catalog_window describe the current settled shelf. animateSearch.visibleResults matches that same settled data.
        - Read the settled results you already have before searching again.
        - If a good match is already visible anywhere in visible_products, use that product id directly even if it is not the first result.
        - If the current results are promising but incomplete, use scrollCatalog. If they are noisy or off-target, refine the search term or category.
        - Use setCategory for broad aisle-level narrowing, not as a substitute for reading the visible results.
        - updateCart changes one product at a time. If an item is already in the basket, update it directly instead of searching again.
        - Local names such as atta, maida, suji, musur dal, moogh dal, chinigura, borhani, and kasundi are product types.
        - Prefixes such as Teer, ACI, Fresh, Pran, Aarong, Radhuni, and Ispahani are usually brands. Unless the user asks for a brand, judge the match mainly by the underlying product type, name, and pack size.
        - Skip price-on-request items because they cannot be added to cart.
        - Ask a short clarifying question only if the settled results and a few more pages still do not show a convincing match.

        Keep suggestions brief and practical.
    `;

export const chatTheme = {
    '--pu-bg': '#fffcf5',
    '--pu-fg': '#30261a',
    '--pu-surface': '#f5f0e4',
    '--pu-muted': '#7d7266',
    '--pu-divider': '#c4b8a4',
    '--pu-accent': '#ffa700',
    '--pu-shadow': '0 24px 70px rgba(180, 130, 40, 0.16)',
} as const;

export const assistantConfig = {
    systemPrompt,
    chatTheme,
    schemas: {
        featuredCategorySchema,
        visibleProductCardSchema,
        animateSearchVisibleResultSchema,
        searchStatusSchema,
        cartSummarySchema,
        catalogWindowSummarySchema,
        animateSearchInputSchema,
        animateSearchOutputSchema,
        categorySelectionSchema,
        categorySelectionOutputSchema,
        cartInputSchema,
        cartOutputSchema,
        catalogWindowSchema,
        scrollCatalogInputSchema,
    },
} as const;
