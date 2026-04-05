import {TRPCError} from '@trpc/server';
import type {Kysely} from 'kysely';
import type {TDatabase} from '#core/db/types.mjs';
import type {TSelectableBlock, TSelectableTurn} from '#core/db/types.mjs';
import type {TUserBlock} from './schemas.mjs';
import {
    MAX_AGENT_TURNS,
    MAX_CONSECUTIVE_FAILED_EXECUTION_TURNS,
} from './schemas.mjs';

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

type TRunSegment = {
    readonly turns: readonly TSelectableTurn[];
    readonly blocks: readonly TSelectableBlock[];
};

type TTurnBudget = {
    readonly agentTurnCount: number;
    readonly turnsRemaining: number;
    readonly isForceStop: boolean;
};

type TFailedExecutionBudget = {
    readonly failedExecutionTurnCount: number;
    readonly turnsRemaining: number;
    readonly isForceStop: boolean;
};

const buildBlocksByTurnId = (
    blocks: readonly TSelectableBlock[],
): Readonly<Record<string, readonly TSelectableBlock[]>> =>
    blocks.reduce<Record<string, readonly TSelectableBlock[]>>((acc, block) => {
        const existing = acc[block.turn_id] ?? [];
        return {...acc, [block.turn_id]: [...existing, block]};
    }, {});

const isStoredTrueUserTurn = (blocks: readonly TSelectableBlock[]): boolean =>
    blocks.length > 0 && blocks.every((block) => block.type === 'text');

const isCurrentTrueUserTurn = (blocks: readonly TUserBlock[]): boolean =>
    blocks.length > 0 && blocks.every((block) => block.type === 'text');

const isStoredFailedExecutionTurn = (
    blocks: readonly TSelectableBlock[],
): boolean =>
    blocks.length > 0 &&
    blocks.every((block) => block.type === 'tool_result') &&
    blocks.every((block) => {
        const payload = block.payload as {error: string | null};
        return payload.error !== null;
    });

const isCurrentFailedExecutionTurn = (blocks: readonly TUserBlock[]): boolean =>
    blocks.length > 0 &&
    blocks.every((block) => block.type === 'execution_result') &&
    blocks.every((block) => block.error !== null);

const hasSuccessfulExecution = (blocks: readonly TUserBlock[]): boolean =>
    blocks.some(
        (block) => block.type === 'execution_result' && block.error === null,
    );

export const getRunSegmentSinceLastTrueUserTurn = (
    isTrueUserTurn: boolean,
    existingTurns: readonly TSelectableTurn[],
    existingBlocks: readonly TSelectableBlock[],
): TRunSegment => {
    if (isTrueUserTurn) {
        return {turns: [], blocks: []};
    }

    const blocksByTurnId = buildBlocksByTurnId(existingBlocks);
    const lastTrueUserTurnIdx = existingTurns.findLastIndex((turn) => {
        if (turn.actor !== 'user') {
            return false;
        }

        return isStoredTrueUserTurn(blocksByTurnId[turn.id] ?? []);
    });

    const turns =
        lastTrueUserTurnIdx === -1
            ? existingTurns
            : existingTurns.slice(lastTrueUserTurnIdx + 1);
    const turnIds = new Set(turns.map((turn) => turn.id));
    const blocks = existingBlocks.filter((block) => turnIds.has(block.turn_id));

    return {turns, blocks};
};

export const countAgentTurnsSinceLastUserTurn = (
    runSegmentTurns: readonly TSelectableTurn[],
): TTurnBudget => {
    const agentTurnCount = runSegmentTurns.filter(
        (turn) => turn.actor === 'assistant',
    ).length;
    const turnsRemaining = MAX_AGENT_TURNS - agentTurnCount;

    return {
        agentTurnCount,
        turnsRemaining,
        isForceStop: turnsRemaining <= 0,
    };
};

export const countConsecutiveFailedExecutionTurns = (
    runSegmentTurns: readonly TSelectableTurn[],
    runSegmentBlocks: readonly TSelectableBlock[],
    currentBlocks: readonly TUserBlock[],
): TFailedExecutionBudget => {
    if (
        isCurrentTrueUserTurn(currentBlocks) ||
        hasSuccessfulExecution(currentBlocks) ||
        !isCurrentFailedExecutionTurn(currentBlocks)
    ) {
        return {
            failedExecutionTurnCount: 0,
            turnsRemaining: MAX_CONSECUTIVE_FAILED_EXECUTION_TURNS,
            isForceStop: false,
        };
    }

    const blocksByTurnId = buildBlocksByTurnId(runSegmentBlocks);
    let priorFailedExecutionTurnCount = 0;

    for (let i = runSegmentTurns.length - 1; i >= 0; i--) {
        const turn = runSegmentTurns[i];

        if (turn.actor !== 'user') {
            continue;
        }

        const turnBlocks = blocksByTurnId[turn.id] ?? [];
        if (!isStoredFailedExecutionTurn(turnBlocks)) {
            break;
        }

        priorFailedExecutionTurnCount++;
    }

    const failedExecutionTurnCount = priorFailedExecutionTurnCount + 1;
    const turnsRemaining =
        MAX_CONSECUTIVE_FAILED_EXECUTION_TURNS - failedExecutionTurnCount;

    return {
        failedExecutionTurnCount,
        turnsRemaining,
        isForceStop: turnsRemaining <= 0,
    };
};
