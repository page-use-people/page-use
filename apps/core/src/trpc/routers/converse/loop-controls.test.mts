import type {MessageParam} from '@anthropic-ai/sdk/resources/messages';
import type {TSelectableBlock, TSelectableTurn} from '#core/db/types.mjs';
import {MAX_AGENT_TURNS, MAX_CONSECUTIVE_EDIT_FAILURES, MAX_CONSECUTIVE_FAILED_EXECUTION_TURNS, type TUserBlock} from './schemas.mjs';
import {countConsecutiveEditFailures} from './blocks.mjs';
import {
    countAgentTurnsSinceLastUserTurn,
    countConsecutiveFailedExecutionTurns,
    getRunSegmentSinceLastTrueUserTurn,
} from './guards.mjs';
import {applyForceStop} from './messages.mjs';

const CONVERSATION_ID = 'conversation-1';

const makeTurn = (
    id: string,
    actor: 'user' | 'assistant',
    createdAtMs: number,
): TSelectableTurn => ({
    id,
    conversation_id: CONVERSATION_ID,
    actor,
    created_at: new Date(createdAtMs),
});

const makeTextBlock = (
    id: string,
    turnId: string,
    message: string,
    createdAtMs: number,
): TSelectableBlock => ({
    id,
    conversation_id: CONVERSATION_ID,
    turn_id: turnId,
    type: 'text',
    payload: {message},
    created_at: new Date(createdAtMs),
});

const makeToolUseBlock = (
    id: string,
    turnId: string,
    executionIdentifier: string,
    toolName: string,
    createdAtMs: number,
): TSelectableBlock => ({
    id,
    conversation_id: CONVERSATION_ID,
    turn_id: turnId,
    type: 'tool_use',
    payload: {
        execution_identifier: executionIdentifier,
        tool_name: toolName,
        description: toolName,
        code: `// ${executionIdentifier}`,
    },
    created_at: new Date(createdAtMs),
});

const makeToolResultBlock = (
    id: string,
    turnId: string,
    executionIdentifier: string,
    error: string | null,
    createdAtMs: number,
): TSelectableBlock => ({
    id,
    conversation_id: CONVERSATION_ID,
    turn_id: turnId,
    type: 'tool_result',
    payload: {
        execution_identifier: executionIdentifier,
        result: 'result',
        error,
    },
    created_at: new Date(createdAtMs),
});

const makeExecutionResult = (
    executionIdentifier: string,
    error: string | null,
): TUserBlock => ({
    type: 'execution_result',
    execution_identifier: executionIdentifier,
    result: 'result',
    error,
});

const buildPendingRun = (options?: {
    priorFailedTurns?: number;
    priorToolName?: string;
    pendingToolName?: string;
}): {
    existingTurns: TSelectableTurn[];
    existingBlocks: TSelectableBlock[];
    pendingExecutionIdentifier: string;
} => {
    const priorFailedTurns = options?.priorFailedTurns ?? 0;
    const priorToolName = options?.priorToolName ?? 'write_and_run_js';
    const pendingToolName = options?.pendingToolName ?? priorToolName;

    let createdAtMs = 1;
    const existingTurns: TSelectableTurn[] = [];
    const existingBlocks: TSelectableBlock[] = [];

    existingTurns.push(makeTurn('user-0', 'user', createdAtMs++));
    existingBlocks.push(
        makeTextBlock('block-text-0', 'user-0', 'Help me', createdAtMs++),
    );

    for (let i = 1; i <= priorFailedTurns; i++) {
        const executionIdentifier = `execution-${i}`;
        const assistantTurnId = `assistant-${i}`;
        const userTurnId = `user-${i}`;

        existingTurns.push(makeTurn(assistantTurnId, 'assistant', createdAtMs++));
        existingBlocks.push(
            makeToolUseBlock(
                `block-tool-use-${i}`,
                assistantTurnId,
                executionIdentifier,
                priorToolName,
                createdAtMs++,
            ),
        );

        existingTurns.push(makeTurn(userTurnId, 'user', createdAtMs++));
        existingBlocks.push(
            makeToolResultBlock(
                `block-tool-result-${i}`,
                userTurnId,
                executionIdentifier,
                `error-${i}`,
                createdAtMs++,
            ),
        );
    }

    const pendingExecutionIdentifier = `execution-${priorFailedTurns + 1}`;
    const pendingAssistantTurnId = `assistant-${priorFailedTurns + 1}`;
    existingTurns.push(
        makeTurn(pendingAssistantTurnId, 'assistant', createdAtMs++),
    );
    existingBlocks.push(
        makeToolUseBlock(
            `block-tool-use-${priorFailedTurns + 1}`,
            pendingAssistantTurnId,
            pendingExecutionIdentifier,
            pendingToolName,
            createdAtMs++,
        ),
    );

    return {existingTurns, existingBlocks, pendingExecutionIdentifier};
};

describe('loop controls', () => {
    test('failed execution turns increment across consecutive failing follow-up turns', () => {
        const {existingTurns, existingBlocks, pendingExecutionIdentifier} =
            buildPendingRun({priorFailedTurns: 1});
        const runSegment = getRunSegmentSinceLastTrueUserTurn(
            false,
            existingTurns,
            existingBlocks,
        );

        const budget = countConsecutiveFailedExecutionTurns(
            runSegment.turns,
            runSegment.blocks,
            [makeExecutionResult(pendingExecutionIdentifier, 'boom')],
        );

        expect(budget.failedExecutionTurnCount).toBe(2);
        expect(budget.turnsRemaining).toBe(4);
        expect(budget.isForceStop).toBe(false);
    });

    test('any successful execution result resets the failed execution turn streak', () => {
        const {existingTurns, existingBlocks, pendingExecutionIdentifier} =
            buildPendingRun({priorFailedTurns: 3});
        const runSegment = getRunSegmentSinceLastTrueUserTurn(
            false,
            existingTurns,
            existingBlocks,
        );

        const budget = countConsecutiveFailedExecutionTurns(
            runSegment.turns,
            runSegment.blocks,
            [makeExecutionResult(pendingExecutionIdentifier, null)],
        );

        expect(budget.failedExecutionTurnCount).toBe(0);
        expect(budget.turnsRemaining).toBe(6);
        expect(budget.isForceStop).toBe(false);
    });

    test('a new true user turn resets the run segment and all streaks', () => {
        const {existingTurns, existingBlocks} = buildPendingRun({
            priorFailedTurns: 2,
        });
        const runSegment = getRunSegmentSinceLastTrueUserTurn(
            true,
            existingTurns,
            existingBlocks,
        );

        const budget = countConsecutiveFailedExecutionTurns(
            runSegment.turns,
            runSegment.blocks,
            [{type: 'text', message: 'Try something else'}],
        );

        expect(runSegment.turns).toEqual([]);
        expect(runSegment.blocks).toEqual([]);
        expect(budget.failedExecutionTurnCount).toBe(0);
        expect(budget.turnsRemaining).toBe(6);
        expect(budget.isForceStop).toBe(false);
    });

    test('failed execution turn stop triggers on the exact threshold call', () => {
        const {existingTurns, existingBlocks, pendingExecutionIdentifier} =
            buildPendingRun({priorFailedTurns: 5});
        const runSegment = getRunSegmentSinceLastTrueUserTurn(
            false,
            existingTurns,
            existingBlocks,
        );

        const budget = countConsecutiveFailedExecutionTurns(
            runSegment.turns,
            runSegment.blocks,
            [makeExecutionResult(pendingExecutionIdentifier, 'boom')],
        );

        expect(budget.failedExecutionTurnCount).toBe(MAX_CONSECUTIVE_FAILED_EXECUTION_TURNS);
        expect(budget.turnsRemaining).toBe(0);
        expect(budget.isForceStop).toBe(true);
    });

    test('the large agent turn backstop still trips independently', () => {
        const {existingTurns, existingBlocks} = buildPendingRun({
            priorFailedTurns: 19,
        });
        const runSegment = getRunSegmentSinceLastTrueUserTurn(
            false,
            existingTurns,
            existingBlocks,
        );

        const budget = countAgentTurnsSinceLastUserTurn(runSegment.turns);

        expect(budget.agentTurnCount).toBe(MAX_AGENT_TURNS);
        expect(budget.turnsRemaining).toBe(0);
        expect(budget.isForceStop).toBe(true);
    });

    test('edit failures are counted on the exact call that receives the latest failed result', () => {
        const {existingTurns, existingBlocks, pendingExecutionIdentifier} =
            buildPendingRun({
                priorFailedTurns: 2,
                priorToolName: 'edit_and_run_js',
                pendingToolName: 'edit_and_run_js',
            });
        const runSegment = getRunSegmentSinceLastTrueUserTurn(
            false,
            existingTurns,
            existingBlocks,
        );

        const editFailures = countConsecutiveEditFailures(runSegment.blocks, [
            makeExecutionResult(pendingExecutionIdentifier, 'boom'),
        ]);

        expect(editFailures).toBe(MAX_CONSECUTIVE_EDIT_FAILURES);
    });

    test('a successful tool run resets the edit failure streak', () => {
        const {existingTurns, existingBlocks, pendingExecutionIdentifier} =
            buildPendingRun({
                priorFailedTurns: 2,
                priorToolName: 'edit_and_run_js',
                pendingToolName: 'edit_and_run_js',
            });
        const runSegment = getRunSegmentSinceLastTrueUserTurn(
            false,
            existingTurns,
            existingBlocks,
        );

        const editFailures = countConsecutiveEditFailures(runSegment.blocks, [
            makeExecutionResult(pendingExecutionIdentifier, null),
        ]);

        expect(editFailures).toBe(0);
    });

    test('the edit failure guard stays narrow and ignores non-edit failures', () => {
        const {existingTurns, existingBlocks, pendingExecutionIdentifier} =
            buildPendingRun({
                priorFailedTurns: 2,
                priorToolName: 'edit_and_run_js',
                pendingToolName: 'write_and_run_js',
            });
        const runSegment = getRunSegmentSinceLastTrueUserTurn(
            false,
            existingTurns,
            existingBlocks,
        );

        const editFailures = countConsecutiveEditFailures(runSegment.blocks, [
            makeExecutionResult(pendingExecutionIdentifier, 'boom'),
        ]);

        expect(editFailures).toBe(0);
    });

    test('force stop appends the apology instruction without dropping tool results', () => {
        const messages: MessageParam[] = [
            {
                role: 'assistant',
                content: [
                    {
                        type: 'tool_use',
                        id: 'execution-1',
                        name: 'retrying',
                        input: {js_code: 'await retry()'},
                    },
                ],
            },
            {
                role: 'user',
                content: [
                    {
                        type: 'tool_result',
                        tool_use_id: 'execution-1',
                        content: 'result\n--- ERROR ---\nboom',
                        is_error: true,
                    },
                ],
            },
        ];

        applyForceStop(messages, 'failed_execution_turns');

        expect(messages[0]).toMatchObject({
            role: 'assistant',
            content: [{type: 'tool_use', id: 'execution-1'}],
        });
        expect(messages[1].role).toBe('user');
        expect(Array.isArray(messages[1].content)).toBe(true);
        expect(messages[1].content).toMatchObject([
            {type: 'tool_result', tool_use_id: 'execution-1'},
            {type: 'text'},
        ]);
        expect(messages[1].content).toContainEqual(
            expect.objectContaining({
                type: 'text',
                text: expect.stringContaining(
                    'consecutive failed execution turns',
                ),
            }),
        );
    });

    test('agent turn backstop force stop uses the total turn limit instruction', () => {
        const messages: MessageParam[] = [
            {
                role: 'user',
                content: [{type: 'text', text: 'Current results'}],
            },
        ];

        applyForceStop(messages, 'max_agent_turns');

        expect(messages[0].content).toContainEqual(
            expect.objectContaining({
                type: 'text',
                text: expect.stringContaining('total execution turns'),
            }),
        );
    });
});
