import {create} from 'zustand';
import type {TFlatItem} from '../lib/search';

export type TCartEntry = {
    readonly item: TFlatItem;
    readonly quantity: number;
};

type TCartState = {
    readonly entries: ReadonlyMap<string, TCartEntry>;
    readonly addItem: (item: TFlatItem) => void;
    readonly removeItem: (id: string) => void;
    readonly incrementItem: (id: string) => void;
    readonly decrementItem: (id: string) => void;
    readonly clearCart: () => void;
};

const EMPTY_MAP: ReadonlyMap<string, TCartEntry> = Object.freeze(new Map());

export const useCartStore = create<TCartState>((set) => ({
    entries: EMPTY_MAP,

    addItem: (item) =>
        set((state) => {
            const next = new Map(state.entries);
            const existing = next.get(item.id);
            next.set(
                item.id,
                Object.freeze({
                    item,
                    quantity: existing ? existing.quantity + 1 : 1,
                }),
            );
            return {entries: next};
        }),

    removeItem: (id) =>
        set((state) => {
            const next = new Map(state.entries);
            next.delete(id);
            return {entries: next.size === 0 ? EMPTY_MAP : next};
        }),

    incrementItem: (id) =>
        set((state) => {
            const existing = state.entries.get(id);
            if (!existing) {
                return state;
            }
            const next = new Map(state.entries);
            next.set(
                id,
                Object.freeze({
                    item: existing.item,
                    quantity: existing.quantity + 1,
                }),
            );
            return {entries: next};
        }),

    decrementItem: (id) =>
        set((state) => {
            const existing = state.entries.get(id);
            if (!existing) {
                return state;
            }
            const next = new Map(state.entries);
            if (existing.quantity <= 1) {
                next.delete(id);
                return {entries: next.size === 0 ? EMPTY_MAP : next};
            }
            next.set(
                id,
                Object.freeze({
                    item: existing.item,
                    quantity: existing.quantity - 1,
                }),
            );
            return {entries: next};
        }),

    clearCart: () => set({entries: EMPTY_MAP}),
}));

// --- Selectors ---

export const getQuantity = (state: TCartState, id: string): number =>
    state.entries.get(id)?.quantity ?? 0;

export const getCartEntries = (
    state: TCartState,
): readonly TCartEntry[] => Array.from(state.entries.values());

export const getGrandTotal = (state: TCartState): number =>
    Array.from(state.entries.values()).reduce(
        (sum, entry) => sum + entry.item.currentPrice * entry.quantity,
        0,
    );

export const getIsEmpty = (state: TCartState): boolean =>
    state.entries.size === 0;
