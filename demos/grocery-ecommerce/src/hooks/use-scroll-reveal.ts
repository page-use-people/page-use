import type {TElementRegistry} from './use-element-registry.ts';
import {nextFrame} from '../lib/async-animation.ts';
import {wait} from '../lib/catalog.ts';

type TRevealPlacement = 'top' | 'center' | 'bottom';

const revealElement = async (
    element: Element | null,
    placement: TRevealPlacement = 'center',
    signal?: AbortSignal,
    behavior: ScrollBehavior = 'smooth',
) => {
    if (!element) {
        return;
    }

    const rect = element.getBoundingClientRect();
    const absoluteTop = window.scrollY + rect.top;
    const padding = 20;
    const topSafeZone = placement === 'top' ? 18 : 72;
    const bottomSafeZone = placement === 'bottom' ? 18 : 96;
    const isAlreadyVisible =
        rect.top >= topSafeZone &&
        rect.bottom <= window.innerHeight - bottomSafeZone;
    const maxScrollTop = Math.max(
        0,
        document.documentElement.scrollHeight - window.innerHeight,
    );

    if (isAlreadyVisible) {
        await nextFrame(signal);
        return;
    }

    const targetTop =
        placement === 'top'
            ? absoluteTop - padding
            : placement === 'bottom'
              ? absoluteTop - window.innerHeight + rect.height + padding
              : absoluteTop - (window.innerHeight - rect.height) / 2;

    const clampedTargetTop = Math.max(
        0,
        Math.min(Math.round(targetTop), maxScrollTop),
    );

    if (Math.abs(clampedTargetTop - window.scrollY) < 12) {
        await nextFrame(signal);
        return;
    }

    window.scrollTo({top: clampedTargetTop, behavior});
    await wait(180, signal);
    await nextFrame(signal);
    await nextFrame(signal);
};

export const useScrollReveal = (refs: TElementRegistry) => {
    const scrollSearchAreaIntoView = async (
        signal?: AbortSignal,
        behavior: ScrollBehavior = 'smooth',
    ) => {
        await revealElement(refs.searchPanel.current, 'top', signal, behavior);
    };

    const revealCategoryButton = async (
        button: HTMLButtonElement | null,
        signal?: AbortSignal,
    ) => {
        await revealElement(refs.searchPanel.current, 'top', signal);
        button?.scrollIntoView({
            behavior: 'smooth',
            inline: 'center',
            block: 'nearest',
        });
        await wait(120, signal);
        await nextFrame(signal);
    };

    const revealCatalogResults = async (signal?: AbortSignal) => {
        await revealElement(
            refs.gridHeading.current ?? refs.gridSection.current,
            'top',
            signal,
        );
    };

    const revealCartPanel = async (signal?: AbortSignal) => {
        await nextFrame(signal);
    };

    const revealCartLine = async (
        productId: number,
        signal?: AbortSignal,
    ) => {
        await revealCartPanel(signal);
        const line = refs.cartLines.current.get(productId) ?? null;
        line?.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'nearest',
        });
        await wait(90, signal);
        await nextFrame(signal);
    };

    return {
        revealElement,
        scrollSearchAreaIntoView,
        revealCategoryButton,
        revealCatalogResults,
        revealCartPanel,
        revealCartLine,
    } as const;
};

export type TScrollReveal = ReturnType<typeof useScrollReveal>;
