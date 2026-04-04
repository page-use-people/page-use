import {useCallback, useRef} from 'react';

export type TElementRegistry = {
    readonly searchInput: React.RefObject<HTMLInputElement | null>;
    readonly searchPanel: React.RefObject<HTMLDivElement | null>;
    readonly allCategoryButton: React.RefObject<HTMLButtonElement | null>;
    readonly categoryButtons: React.RefObject<Map<string, HTMLButtonElement>>;
    readonly productCards: React.RefObject<Map<number, HTMLElement>>;
    readonly gridSection: React.RefObject<HTMLElement | null>;
    readonly gridHeading: React.RefObject<HTMLDivElement | null>;
    readonly gridWindowNav: React.RefObject<HTMLDivElement | null>;
    readonly previousWindowButton: React.RefObject<HTMLButtonElement | null>;
    readonly nextWindowButton: React.RefObject<HTMLButtonElement | null>;
    readonly cartPanel: React.RefObject<HTMLElement | null>;
    readonly cartLines: React.RefObject<Map<number, HTMLElement>>;
    readonly cursor: React.RefObject<HTMLDivElement | null>;
    readonly cursorLabel: React.RefObject<HTMLDivElement | null>;
};

export type TElementRegistryCallbacks = {
    readonly registerSearchInput: (node: HTMLInputElement | null) => void;
    readonly registerSearchPanel: (node: HTMLDivElement | null) => void;
    readonly registerAllCategoryButton: (
        node: HTMLButtonElement | null,
    ) => void;
    readonly registerCategoryButton: (
        categoryKey: string,
        node: HTMLButtonElement | null,
    ) => void;
    readonly registerProductCard: (
        productId: number,
        node: HTMLElement | null,
    ) => void;
    readonly registerGridSection: (node: HTMLElement | null) => void;
    readonly registerGridHeading: (node: HTMLDivElement | null) => void;
    readonly registerGridWindowNav: (node: HTMLDivElement | null) => void;
    readonly registerPreviousWindowButton: (
        node: HTMLButtonElement | null,
    ) => void;
    readonly registerNextWindowButton: (
        node: HTMLButtonElement | null,
    ) => void;
    readonly registerCartPanel: (node: HTMLElement | null) => void;
    readonly registerCartLine: (
        productId: number,
        node: HTMLElement | null,
    ) => void;
};

const registerMapEntry = <K, V extends Element>(
    mapRef: React.RefObject<Map<K, V>>,
    key: K,
    node: V | null,
) => {
    node
        ? mapRef.current.set(key, node)
        : mapRef.current.delete(key);
};

export const useElementRegistry = (): {
    readonly refs: TElementRegistry;
    readonly callbacks: TElementRegistryCallbacks;
} => {
    const searchInput = useRef<HTMLInputElement | null>(null);
    const searchPanel = useRef<HTMLDivElement | null>(null);
    const allCategoryButton = useRef<HTMLButtonElement | null>(null);
    const categoryButtons = useRef<Map<string, HTMLButtonElement>>(new Map());
    const productCards = useRef<Map<number, HTMLElement>>(new Map());
    const gridSection = useRef<HTMLElement | null>(null);
    const gridHeading = useRef<HTMLDivElement | null>(null);
    const gridWindowNav = useRef<HTMLDivElement | null>(null);
    const previousWindowButton = useRef<HTMLButtonElement | null>(null);
    const nextWindowButton = useRef<HTMLButtonElement | null>(null);
    const cartPanel = useRef<HTMLElement | null>(null);
    const cartLines = useRef<Map<number, HTMLElement>>(new Map());
    const cursor = useRef<HTMLDivElement | null>(null);
    const cursorLabel = useRef<HTMLDivElement | null>(null);

    const refs: TElementRegistry = {
        searchInput,
        searchPanel,
        allCategoryButton,
        categoryButtons,
        productCards,
        gridSection,
        gridHeading,
        gridWindowNav,
        previousWindowButton,
        nextWindowButton,
        cartPanel,
        cartLines,
        cursor,
        cursorLabel,
    };

    const registerSearchInput = useCallback(
        (node: HTMLInputElement | null) => {
            searchInput.current = node;
        },
        [],
    );
    const registerSearchPanel = useCallback(
        (node: HTMLDivElement | null) => {
            searchPanel.current = node;
        },
        [],
    );
    const registerAllCategoryButton = useCallback(
        (node: HTMLButtonElement | null) => {
            allCategoryButton.current = node;
        },
        [],
    );
    const registerCategoryButton = useCallback(
        (categoryKey: string, node: HTMLButtonElement | null) => {
            registerMapEntry(categoryButtons, categoryKey, node);
        },
        [],
    );
    const registerProductCard = useCallback(
        (productId: number, node: HTMLElement | null) => {
            registerMapEntry(productCards, productId, node);
        },
        [],
    );
    const registerGridSection = useCallback(
        (node: HTMLElement | null) => {
            gridSection.current = node;
        },
        [],
    );
    const registerGridHeading = useCallback(
        (node: HTMLDivElement | null) => {
            gridHeading.current = node;
        },
        [],
    );
    const registerGridWindowNav = useCallback(
        (node: HTMLDivElement | null) => {
            gridWindowNav.current = node;
        },
        [],
    );
    const registerPreviousWindowButton = useCallback(
        (node: HTMLButtonElement | null) => {
            previousWindowButton.current = node;
        },
        [],
    );
    const registerNextWindowButton = useCallback(
        (node: HTMLButtonElement | null) => {
            nextWindowButton.current = node;
        },
        [],
    );
    const registerCartPanel = useCallback(
        (node: HTMLElement | null) => {
            cartPanel.current = node;
        },
        [],
    );
    const registerCartLine = useCallback(
        (productId: number, node: HTMLElement | null) => {
            registerMapEntry(cartLines, productId, node);
        },
        [],
    );

    const callbacks: TElementRegistryCallbacks = {
        registerSearchInput,
        registerSearchPanel,
        registerAllCategoryButton,
        registerCategoryButton,
        registerProductCard,
        registerGridSection,
        registerGridHeading,
        registerGridWindowNav,
        registerPreviousWindowButton,
        registerNextWindowButton,
        registerCartPanel,
        registerCartLine,
    };

    return {refs, callbacks};
};
