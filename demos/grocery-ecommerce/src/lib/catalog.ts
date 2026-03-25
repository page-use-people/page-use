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
    readonly accent: string;
    readonly support: string;
    readonly deep: string;
    readonly ink: string;
    readonly soft: string;
    readonly mist: string;
    readonly foregroundOnAccent: string;
    readonly foregroundOnSoft: string;
    readonly glow: string;
    readonly shell: string;
    readonly gradient: string;
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

const hexToRgb = (hex: string) => {
    const normalized = hex.replace('#', '');
    const int = Number.parseInt(normalized, 16);
    return {
        r: (int >> 16) & 255,
        g: (int >> 8) & 255,
        b: int & 255,
    };
};

const withAlpha = (hex: string, alpha: number) => {
    const {r, g, b} = hexToRgb(hex);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const relativeLuminance = (hex: string) => {
    const {r, g, b} = hexToRgb(hex);
    const channels = [r, g, b].map((channel) => {
        const normalized = channel / 255;
        return normalized <= 0.03928
            ? normalized / 12.92
            : ((normalized + 0.055) / 1.055) ** 2.4;
    });
    return (
        0.2126 * (channels[0] ?? 0) +
        0.7152 * (channels[1] ?? 0) +
        0.0722 * (channels[2] ?? 0)
    );
};

const contrastText = (hex: string) =>
    relativeLuminance(hex) > 0.42 ? '#130f12' : '#fcf7ef';

const isHexColor = (value: unknown): value is string =>
    typeof value === 'string' && /^#?[0-9a-f]{6}$/i.test(value.trim());

const normalizeHex = (value: string) =>
    value.startsWith('#') ? value : `#${value}`;

const pickPaletteColor = (value: TPaletteValue | undefined, fallback: string) =>
    isHexColor(value) ? normalizeHex(value.trim()) : fallback;

const normalizeTheme = (palette: readonly TPaletteValue[]): TProductTheme => {
    const [rawAccent, rawSupport, rawDeep, rawInk, rawSoft, rawMist] = palette;

    const accent = pickPaletteColor(rawAccent, '#dca62d');
    const support = pickPaletteColor(rawSupport, '#ab8352');
    const deep = pickPaletteColor(rawDeep, '#5c2c14');
    const ink = pickPaletteColor(rawInk, '#717439');
    const soft = pickPaletteColor(rawSoft, '#e0b96a');
    const mist = pickPaletteColor(rawMist, '#cd9895');

    return {
        accent,
        support,
        deep,
        ink,
        soft,
        mist,
        foregroundOnAccent: contrastText(accent),
        foregroundOnSoft: contrastText(soft),
        glow: withAlpha(accent, 0.24),
        shell: withAlpha(mist, 0.18),
        gradient: `linear-gradient(135deg, ${accent} 0%, ${support} 42%, ${deep} 100%)`,
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
            price: product.price,
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
    price === null ? 'Ask for price' : `BDT ${price.toLocaleString('en-US')}`;

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
