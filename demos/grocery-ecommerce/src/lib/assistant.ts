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
    readonly accent: string;
    readonly shell: string;
    readonly imageUrl: string;
};

export type TAnimateSearchResult = {
    readonly resultCount: number;
    readonly leadingResultId: number | null;
    readonly leadingResultTitle: string | null;
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
    .string()
    .describe('compact list of addable visible products; each line starts with the product id');

export const cartSummarySchema = z
    .string()
    .describe('compact basket summary with item ids and quantities');

export const nullableSpotlightSchema = z
    .string()
    .nullable()
    .describe('compact summary of the product open in the detail modal');

export const catalogWindowSummarySchema = z
    .string()
    .describe('compact summary of the current result window');

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
        resultCount: z.number().describe('number of matching products'),
        leadingResultId: z.number().nullable().describe('first matching product id if any'),
        leadingResultTitle: z
            .string()
            .nullable()
            .describe('first matching product title if any'),
    })
    .describe('search results after the query is applied');

export const categorySelectionSchema = z
    .object({
        categoryKey: z
            .string()
            .nullable()
            .describe('category key to browse, or null to clear category filtering'),
    })
    .describe('change the active category filter');

export const categorySelectionOutputSchema = z
    .object({
        selectedCategory: z.string().nullable().describe('resulting category key'),
        productCount: z
            .number()
            .describe('count of matching products under the current filters'),
    })
    .describe('result of changing category or clearing search');

export const spotlightInputSchema = z
    .object({
        productId: z.number().describe('product id to open'),
    })
    .describe('open a product detail view');

export const spotlightOutputSchema = z
    .object({
        productId: z.number().describe('opened product id'),
        productTitle: z.string().describe('opened product title'),
    })
    .describe('product now open in the detail view');

export const cartInputSchema = z
    .object({
        productId: z.number().describe('product id to add or remove'),
        quantityDelta: z.number().describe('positive to add, negative to remove'),
    })
    .describe('adjust the quantity of a product in the basket');

export const cartOutputSchema = z
    .object({
        totalItems: z.number().describe('total quantity after mutation'),
        subtotal: z
            .number()
            .nullable()
            .describe('basket subtotal in BDT when all prices are known'),
    })
    .describe('basket totals after the quantity change');

export const catalogWindowSchema = z
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

export const chatTheme = {
    '--pu-bg': '#18130f',
    '--pu-fg': '#f7f0e8',
    '--pu-surface': 'rgba(255,255,255,0.08)',
    '--pu-muted': 'rgba(247,240,232,0.48)',
    '--pu-divider': 'rgba(247,240,232,0.12)',
    '--pu-accent': '#d06b34',
    '--pu-shadow': '0 30px 90px rgba(39, 24, 16, 0.24)',
} as const;

export const assistantConfig = {
    systemPrompt,
    chatTheme,
    schemas: {
        featuredCategorySchema,
        visibleProductCardSchema,
        cartSummarySchema,
        nullableSpotlightSchema,
        catalogWindowSummarySchema,
        animateSearchInputSchema,
        animateSearchOutputSchema,
        categorySelectionSchema,
        categorySelectionOutputSchema,
        spotlightInputSchema,
        spotlightOutputSchema,
        cartInputSchema,
        cartOutputSchema,
        catalogWindowSchema,
        scrollCatalogInputSchema,
    },
} as const;
