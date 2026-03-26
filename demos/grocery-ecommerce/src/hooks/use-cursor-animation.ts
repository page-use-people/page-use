import {useEffect, useRef, useState} from 'react';
import type {TAgentAction, TFauxCursorMode} from '../types/cursor.ts';
import type {TElementRegistry} from './use-element-registry.ts';
import {easeInOutCubic} from '../lib/async-animation.ts';
import {wait} from '../lib/catalog.ts';

export const useCursorAnimation = (refs: TElementRegistry) => {
    const [agentAction, setAgentAction] = useState<TAgentAction | null>(null);
    const cursorPositionRef = useRef({x: 96, y: 96});

    useEffect(() => {
        const cursor = refs.cursor.current;
        if (!cursor) {
            return;
        }

        cursor.style.opacity = '0';
        cursor.style.transform = `translate(${cursorPositionRef.current.x}px, ${cursorPositionRef.current.y}px)`;
    }, [refs.cursor]);

    const setCursorPosition = (x: number, y: number) => {
        cursorPositionRef.current = {x, y};
        const cursor = refs.cursor.current;
        if (!cursor) {
            return;
        }

        cursor.style.transform = `translate(${x}px, ${y}px)`;
    };

    const setCursorMode = (mode: TFauxCursorMode, label: string) => {
        const cursor = refs.cursor.current;
        const labelNode = refs.cursorLabel.current;
        setAgentAction({mode, label});
        if (!cursor || !labelNode) {
            return;
        }

        cursor.dataset.mode = mode;
        cursor.style.opacity = '1';
        labelNode.textContent = label;
    };

    const hideCursor = () => {
        const cursor = refs.cursor.current;
        const labelNode = refs.cursorLabel.current;
        setAgentAction(null);
        if (!cursor || !labelNode) {
            return;
        }

        cursor.style.opacity = '0';
        labelNode.textContent = '';
    };

    const animateCursorToPoint = async (
        targetX: number,
        targetY: number,
        signal?: AbortSignal,
        duration = 260,
    ) => {
        if (signal?.aborted) {
            throw signal.reason ?? new DOMException('Aborted', 'AbortError');
        }

        const start = cursorPositionRef.current;
        await new Promise<void>((resolve, reject) => {
            let frame = 0;
            const startedAt = performance.now();

            const onAbort = () => {
                window.cancelAnimationFrame(frame);
                reject(
                    signal?.reason ??
                        new DOMException('Aborted', 'AbortError'),
                );
            };

            const step = (timestamp: number) => {
                const elapsed = Math.min(
                    (timestamp - startedAt) / duration,
                    1,
                );
                const eased = easeInOutCubic(elapsed);
                setCursorPosition(
                    start.x + (targetX - start.x) * eased,
                    start.y + (targetY - start.y) * eased,
                );

                if (elapsed < 1) {
                    frame = window.requestAnimationFrame(step);
                } else {
                    signal?.removeEventListener('abort', onAbort);
                    resolve();
                }
            };

            signal?.addEventListener('abort', onAbort, {once: true});
            frame = window.requestAnimationFrame(step);
        });
    };

    const pulseCursor = async (signal?: AbortSignal) => {
        const cursor = refs.cursor.current;
        if (!cursor) {
            return;
        }

        cursor.dataset.clicking = 'true';
        await wait(80, signal);
        cursor.dataset.clicking = 'false';
    };

    const moveCursorToElement = async (
        element: Element | null,
        signal?: AbortSignal,
        duration = 220,
    ) => {
        if (!element) {
            return;
        }

        const rect = element.getBoundingClientRect();
        await animateCursorToPoint(
            rect.left + rect.width / 2,
            rect.top + rect.height / 2,
            signal,
            duration,
        );
    };

    const moveCursorToRef = async (
        ref: React.RefObject<Element | null>,
        signal?: AbortSignal,
        duration = 220,
    ) => {
        await moveCursorToElement(ref.current, signal, duration);
    };

    return {
        agentAction,
        setCursorMode,
        hideCursor,
        animateCursorToPoint,
        pulseCursor,
        moveCursorToElement,
        moveCursorToRef,
    } as const;
};

export type TCursorAnimation = ReturnType<typeof useCursorAnimation>;
