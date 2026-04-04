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
                .describe(
                    '1-based position in the settled visible result list',
                ),
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
                .describe(
                    '1-based position in the settled visible result list',
                ),
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

export const animateSearchInputSchema = z
    .object({
        query: z.string().describe('query to search for'),
    })
    .describe('search the catalog for a product');

export const animateSearchOutputSchema = z
    .object({
        appliedQuery: z
            .string()
            .describe(
                'query currently applied to the shelf after search settles',
            ),
        resultCount: z.number().describe('number of matching products'),
        visibleResults: animateSearchVisibleResultSchema,
    })
    .describe('settled search results after the query is fully applied');

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

export const systemPrompt = `
        You are the concierge for a Bangladesh grocery storefront.

        You can read:
        - search_status: includes draft_query and settled_query.
        - visible_products: structured JSON for the currently visible addable products.
        - cart_summary: what is already in the basket.

        You can act with:
        - animateSearch(query)
        - updateCart(productId, quantityDelta)

        Rules:
        - only do one search at a time
        - never search and add in the same turn
        - you may add something, and search for a new thing but never expect to add the very thing you're searching for
        - search for only one thing at a time (the search feature is very primitive)
        - always inspect the search result before adding

        Keep suggestions brief and practical.
    `;

export const chatTheme = {
    '--pu-bg': '#ffffff',
    '--pu-fg': '#30261a',
    '--pu-surface': '#f5f0e4',
    '--pu-muted': '#7d7266',
    '--pu-divider': '#c4b8a4',
    '--pu-accent': '#ffa700',
    '--pu-shadow': '0 8px 30px rgba(100, 100, 80, 0.68)',
} as const;

export const assistantConfig = {
    systemPrompt,
    chatTheme,
    schemas: {
        visibleProductCardSchema,
        animateSearchVisibleResultSchema,
        searchStatusSchema,
        cartSummarySchema,
        animateSearchInputSchema,
        animateSearchOutputSchema,
        cartInputSchema,
        cartOutputSchema,
    },
} as const;
