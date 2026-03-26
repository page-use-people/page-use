import {memo} from 'react';
import type {TAgentAction} from '../types/cursor.ts';

type TAgentStatusBadgeProps = {
    readonly agentAction: TAgentAction | null;
};

export const AgentStatusBadge = memo(
    ({agentAction}: TAgentStatusBadgeProps) => (
        <div
            className="fixed left-4 top-4 z-[65] grid min-w-[12rem] max-w-[min(22rem,calc(100vw-2rem))] gap-[0.28rem] overflow-hidden rounded-[1.2rem] border border-[var(--g-border)] bg-[rgba(255,255,253,0.97)] px-4 py-[0.82rem] shadow-[0_18px_38px_rgba(31,73,55,0.1),inset_0_1px_rgba(255,255,255,0.92)] opacity-0 backdrop-blur-[16px] transition-[opacity,transform,border-color,box-shadow] duration-[220ms] ease-out -translate-y-2 pointer-events-none data-[visible=true]:translate-y-0 data-[visible=true]:opacity-100 data-[visible=true]:animate-[grocery-agent-status-pulse_1.8s_ease-out_infinite] data-[mode=search]:border-[var(--g-accent-soft)] data-[mode=search]:shadow-[0_22px_44px_rgba(47,122,86,0.14),inset_0_1px_rgba(255,255,255,0.92)] data-[mode=cart]:border-[var(--g-citrus-soft)] data-[mode=cart]:shadow-[0_22px_44px_rgba(216,161,63,0.12),inset_0_1px_rgba(255,255,255,0.92)] max-[760px]:left-[0.9rem] max-[760px]:right-[0.9rem] max-[760px]:top-[5.4rem] max-[760px]:max-w-none"
            data-visible={agentAction ? 'true' : 'false'}
            data-mode={agentAction?.mode ?? 'browse'}
            aria-live="polite">
            <span className="inline-flex items-center gap-[0.42rem] text-[0.7rem] font-bold uppercase tracking-[0.16em] text-[var(--g-ink-muted)]">
                <i
                    aria-hidden="true"
                    className="h-[0.58rem] w-[0.58rem] rounded-full bg-[var(--g-accent)]"
                />
                Assistant action
            </span>
            <strong className="text-[0.98rem] leading-[1.3] text-[var(--g-ink)]">
                {agentAction?.label ?? 'Idle'}
            </strong>
        </div>
    ),
    (prev, next) => prev.agentAction === next.agentAction,
);

AgentStatusBadge.displayName = 'AgentStatusBadge';
