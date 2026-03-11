import {TRPCError} from '@trpc/server';
import type {Kysely} from 'kysely';
import type {TDatabase} from '#core/db/types.mjs';
import type {TSelectableBlock, TSelectableTurn} from '#core/db/types.mjs';
import {MAX_AGENT_TURNS} from './schemas.mjs';

// ── Block User Turns While Agent Is Processing ──────────────

export const guardAgentProcessing = async (
    db: Kysely<TDatabase>,
    conversationDBId: string,
): Promise<void> => {
    const lastTurn = await db
        .selectFrom('turns')
        .select(['id', 'actor'])
        .where('conversation_id', '=', conversationDBId)
        .orderBy('created_at', 'desc')
        .limit(1)
        .executeTakeFirst();

    if (!lastTurn) {
        return; // First message in conversation
    }

    const lastTurnBlocks = await db
        .selectFrom('blocks')
        .select('type')
        .where('turn_id', '=', lastTurn.id)
        .execute();

    const isAgentDone =
        lastTurn.actor === 'assistant' &&
        lastTurnBlocks.every(
            (block) => block.type === 'text' || block.type === 'thinking',
        );

    if (!isAgentDone) {
        throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message:
                'Cannot send a new message while the agent is still processing',
        });
    }
};

// ── Agent Turn Counting ─────────────────────────────────────

type TTurnBudget = {
    readonly agentTurnCount: number;
    readonly turnsRemaining: number;
    readonly isForceStop: boolean;
};

export const countAgentTurnsSinceLastUserTurn = (
    isTrueUserTurn: boolean,
    existingTurns: readonly TSelectableTurn[],
    existingBlocks: readonly TSelectableBlock[],
): TTurnBudget => {
    const lastTrueUserTurnIdx = isTrueUserTurn
        ? -1 // current turn is a new user request; budget starts fresh
        : existingTurns.findLastIndex((turn) => {
              if (turn.actor !== 'user') {
                  return false;
              }
              const turnBlocks = existingBlocks.filter(
                  (b) => b.turn_id === turn.id,
              );
              return turnBlocks.every((b) => b.type === 'text');
          });

    const agentTurnCount =
        lastTrueUserTurnIdx === -1
            ? 0
            : existingTurns
                  .slice(lastTrueUserTurnIdx)
                  .filter((t) => t.actor === 'assistant').length;

    const turnsRemaining = MAX_AGENT_TURNS - agentTurnCount;

    return {
        agentTurnCount,
        turnsRemaining,
        isForceStop: turnsRemaining <= 0,
    };
};
