import {createContext, useContext} from 'react';
import type {TElementRegistryCallbacks} from '../hooks/use-element-registry.ts';

export const ElementRegistryContext =
    createContext<TElementRegistryCallbacks | null>(null);

export const useRegistryCallbacks = (): TElementRegistryCallbacks => {
    const context = useContext(ElementRegistryContext);
    if (!context) {
        throw new Error(
            'useRegistryCallbacks must be used within ElementRegistryContext.Provider',
        );
    }
    return context;
};
