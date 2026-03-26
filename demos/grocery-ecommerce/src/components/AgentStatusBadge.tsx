import {memo} from 'react';
import type {TAgentAction} from '../types/cursor.ts';

type TAgentStatusBadgeProps = {
    readonly agentAction: TAgentAction | null;
};

export const AgentStatusBadge = memo(
    ({agentAction}: TAgentStatusBadgeProps) => (
        <div
            className="fixed left-4 top-4 z-40 grid min-w-48 max-w-[min(22rem,calc(100vw-2rem))] gap-1 overflow-hidden rounded-2xl border border-[var(--g-border)] bg-[rgba(255,255,253,0.97)] px-4 py-3.5 shadow-[0_18px_38px_rgba(180,130,40,0.1),inset_0_1px_rgba(255,255,255,0.92)] opacity-0 backdrop-blur-lg transition-[opacity,transform,border-color,box-shadow] duration-200 ease-out -translate-y-2 pointer-events-none data-[visible=true]:translate-y-0 data-[visible=true]:opacity-100 data-[visible=true]:animate-[grocery-agent-status-pulse_1.8s_ease-out_infinite] data-[mode=search]:border-[var(--g-accent-soft)] data-[mode=search]:shadow-[0_22px_44px_rgba(200,150,50,0.14),inset_0_1px_rgba(255,255,255,0.92)] data-[mode=cart]:border-[var(--g-citrus-soft)] data-[mode=cart]:shadow-[0_22px_44px_rgba(216,161,63,0.12),inset_0_1px_rgba(255,255,255,0.92)] max-md:left-3.5 max-md:right-3.5 max-md:top-20 max-md:max-w-none"
            data-visible={agentAction ? 'true' : 'false'}
            data-mode={agentAction?.mode ?? 'browse'}
            aria-live="polite">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-[var(--g-ink-muted)]">
                <i
                    aria-hidden="true"
                    className="h-2 w-2 rounded-full bg-[var(--g-accent)]"
                />
                Assistant action
            </span>
            <strong className="text-base leading-snug text-[var(--g-ink)]">
                {agentAction?.label ?? 'Idle'}
            </strong>
        </div>
    ),
    (prev, next) => prev.agentAction === next.agentAction,
);

AgentStatusBadge.displayName = 'AgentStatusBadge';
