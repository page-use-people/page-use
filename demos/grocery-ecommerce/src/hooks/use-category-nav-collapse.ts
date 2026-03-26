import {useEffect, useEffectEvent, useState} from 'react';
import type {TElementRegistry} from './use-element-registry.ts';

export const useCategoryNavCollapse = (
    refs: TElementRegistry,
    recalcDeps: readonly unknown[],
) => {
    const [isCategoryNavCollapsed, setIsCategoryNavCollapsed] = useState(false);

    const syncCategoryNavVisibility = useEffectEvent(() => {
        const gridTop =
            refs.gridSection.current?.getBoundingClientRect().top ??
            Number.POSITIVE_INFINITY;
        const nextCollapsed = gridTop <= 160;

        setIsCategoryNavCollapsed((current) =>
            current === nextCollapsed ? current : nextCollapsed,
        );
    });

    useEffect(() => {
        let frame = 0;

        const schedule = () => {
            if (frame !== 0) {
                return;
            }

            frame = window.requestAnimationFrame(() => {
                frame = 0;
                syncCategoryNavVisibility();
            });
        };

        schedule();
        window.addEventListener('scroll', schedule, {passive: true});
        window.addEventListener('resize', schedule);

        return () => {
            if (frame !== 0) {
                window.cancelAnimationFrame(frame);
            }

            window.removeEventListener('scroll', schedule);
            window.removeEventListener('resize', schedule);
        };
    }, []);

    useEffect(() => {
        const frame = window.requestAnimationFrame(() => {
            syncCategoryNavVisibility();
        });

        return () => {
            window.cancelAnimationFrame(frame);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, recalcDeps);

    return isCategoryNavCollapsed;
};
