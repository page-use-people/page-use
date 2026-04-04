export const IMAGE_BASE_URL =
    'https://static.airstate.dev/page-use-demo__grocery-ecommerce/images';

export type TRawProduct = {
    readonly id?: number;
    readonly title: string;
    readonly subtitle: string;
    readonly price: number | null;
};

export type TRawCategory = {
    readonly category_key: string;
    readonly category: readonly string[];
    readonly ids: readonly number[];
};

export type TRawProductsPayload = {
    readonly products: readonly TRawProduct[];
    readonly categories: readonly TRawCategory[];
};

type TPaletteValue = string | null;

export type TProductTheme = {
    readonly vibrant: string;
    readonly muted: string;
    readonly darkVibrant: string;
    readonly darkMuted: string;
    readonly lightVibrant: string;
    readonly lightMuted: string;
};

export type TCatalogProduct = {
    readonly id: number;
    readonly order: number;
    readonly title: string;
    readonly subtitle: string;
    readonly price: number | null;
    readonly imageUrl: string;
    readonly slug: string;
    readonly searchText: string;
    readonly searchTokens: readonly string[];
    readonly categoryKeys: readonly string[];
    readonly primaryCategoryKey: string | null;
    readonly primaryCategoryLabel: string | null;
    readonly theme: TProductTheme;
};

export type TCatalogCategory = {
    readonly key: string;
    readonly label: string;
    readonly segments: readonly string[];
    readonly productIds: readonly number[];
    readonly count: number;
};

export type TCatalogData = {
    readonly products: readonly TCatalogProduct[];
    readonly categories: readonly TCatalogCategory[];
    readonly productMap: ReadonlyMap<number, TCatalogProduct>;
    readonly categoryMap: ReadonlyMap<string, TCatalogCategory>;
};

const toTitleCase = (value: string) =>
    value
        .replaceAll('_', ' ')
        .trim()
        .split(/\s+/)
        .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
        .join(' ');

const slugify = (value: string) =>
    value
        .toLowerCase()
        .replaceAll(/[^a-z0-9]+/g, '-')
        .replaceAll(/^-+|-+$/g, '');

export const normalizeSearchValue = (value: string) =>
    value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

export const tokenizeSearchValue = (value: string) =>
    normalizeSearchValue(value)
        .split(/\s+/)
        .filter(Boolean);

const isHexColor = (value: unknown): value is string =>
    typeof value === 'string' && /^#?[0-9a-f]{6}$/i.test(value.trim());

const normalizeHex = (value: string) =>
    value.startsWith('#') ? value : `#${value}`;

const pickPaletteColor = (value: TPaletteValue | undefined, fallback: string) =>
    isHexColor(value) ? normalizeHex(value.trim()) : fallback;

const normalizeTheme = (palette: readonly TPaletteValue[]): TProductTheme => {
    const [rawVibrant, rawMuted, rawDarkVibrant, rawDarkMuted, rawLightVibrant, rawLightMuted] = palette;

    const vibrant = pickPaletteColor(rawVibrant, '#dca62d');
    const muted = pickPaletteColor(rawMuted, '#ab8352');
    const darkVibrant = pickPaletteColor(rawDarkVibrant, '#5c2c14');
    const darkMuted = pickPaletteColor(rawDarkMuted, '#717439');
    const lightVibrant = pickPaletteColor(rawLightVibrant, '#e0b96a');
    const lightMuted = pickPaletteColor(rawLightMuted, '#cd9895');

    return {
        vibrant,
        muted,
        darkVibrant,
        darkMuted,
        lightVibrant,
        lightMuted,
    };
};

const dedupe = <T,>(values: readonly T[]) => [...new Set(values)];

const normalizeCategoryLabel = (segments: readonly string[]) => {
    const cleaned = dedupe(
        segments
            .map((segment) => segment.trim())
            .filter(Boolean),
    );
    return cleaned.map(toTitleCase).join(' / ');
};

export const normalizeCatalog = (
    payload: TRawProductsPayload,
    palettes: readonly (readonly TPaletteValue[])[],
): TCatalogData => {
    if (payload.products.length !== palettes.length) {
        throw new Error(
            `Product/palette length mismatch: ${payload.products.length} !== ${palettes.length}`,
        );
    }

    const categoryMembership = new Map<number, string[]>();
    const normalizedCategories = payload.categories
        .map((category) => {
            const productIds = dedupe(category.ids);
            productIds.forEach((productId) => {
                const existing = categoryMembership.get(productId) ?? [];
                categoryMembership.set(productId, [...existing, category.category_key]);
            });

            return {
                key: category.category_key,
                label: normalizeCategoryLabel(category.category),
                segments: category.category.map(toTitleCase),
                productIds,
                count: productIds.length,
            } satisfies TCatalogCategory;
        })
        .sort((left, right) => right.count - left.count);

    const categoryMap = new Map(
        normalizedCategories.map((category) => [category.key, category]),
    );

    const products = payload.products.map((product, index) => {
        const id = product.id ?? index;
        const categoryKeys = categoryMembership.get(id) ?? [];
        const primaryCategoryKey = categoryKeys[0] ?? null;
        const primaryCategoryLabel = primaryCategoryKey
            ? categoryMap.get(primaryCategoryKey)?.label ?? null
            : null;
        const theme = normalizeTheme(palettes[index] ?? []);
        const title = product.title.trim();
        const subtitle = product.subtitle.trim();
        const categorySearchText = categoryKeys
            .map((categoryKey) => categoryMap.get(categoryKey)?.label ?? categoryKey)
            .join(' ');
        const searchText = normalizeSearchValue(
            `${title} ${subtitle} ${categorySearchText}`,
        );

        return {
            id,
            order: index,
            title,
            subtitle,
            price: product.price === null ? null : Math.round(product.price / 124 * 10) / 10,
            imageUrl: `${IMAGE_BASE_URL}/${id}.png`,
            slug: slugify(`${id}-${title}`),
            searchText,
            searchTokens: tokenizeSearchValue(searchText),
            categoryKeys,
            primaryCategoryKey,
            primaryCategoryLabel,
            theme,
        } satisfies TCatalogProduct;
    });

    return {
        products,
        categories: normalizedCategories,
        productMap: new Map(products.map((product) => [product.id, product])),
        categoryMap,
    };
};

export const formatPrice = (price: number | null) =>
    price === null ? 'Ask for price' : price.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});

export const wait = (ms: number, signal?: AbortSignal) =>
    new Promise<void>((resolve, reject) => {
        if (signal?.aborted) {
            reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
            return;
        }

        const timer = window.setTimeout(() => {
            signal?.removeEventListener('abort', onAbort);
            resolve();
        }, ms);

        const onAbort = () => {
            window.clearTimeout(timer);
            reject(signal?.reason ?? new DOMException('Aborted', 'AbortError'));
        };

        signal?.addEventListener('abort', onAbort, {once: true});
    });
