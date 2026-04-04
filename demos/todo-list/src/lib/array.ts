export const insertAt = <T,>(arr: ReadonlyArray<T>, index: number, item: T): ReadonlyArray<T> =>
    index < 0 ? [...arr, item] : [...arr.slice(0, index), item, ...arr.slice(index)];
