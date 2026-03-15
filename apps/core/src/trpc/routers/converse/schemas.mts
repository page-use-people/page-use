import {z} from 'zod';
import type {Tool} from '@anthropic-ai/sdk/resources/messages';
import {
    assistantBlockSchema,
    userBlockSchema,
} from '#core/trpc/routers/conversation.mjs';
import type {TConversationModel} from '#core/db/overrides.mjs';

// ── Input/Output Schemas ────────────────────────────────────

export const converseInputSchema = z.object({
    conversation_id: z.string(),
    system_prompt: z.string(),
    context: z.array(
        z.object({
            title: z.string().optional(),
            content: z.string(),
        }),
    ),
    available_tools: z.array(
        z.object({
            definition: z.string(),
        }),
    ),
    variables_object_definition: z.string(),
    blocks: z.array(userBlockSchema),
});

export const converseOutputSchema = z.object({
    blocks: z.array(assistantBlockSchema),
});

export type TUserBlock = z.infer<typeof userBlockSchema>;
export type TAssistantBlock = z.infer<typeof assistantBlockSchema>;

// ── Constants ───────────────────────────────────────────────

export const API_MODEL = 'claude-sonnet-4-20250514';
export const DB_MODEL: TConversationModel = 'claude-sonnet-4.6';
export const MAX_TOKENS = 16384;
export const MAX_CONSECUTIVE_EDIT_FAILURES = 3;
export const MAX_AGENT_TURNS = 6;

// ── Anthropic Tool Definitions ──────────────────────────────

export const WRITE_AND_RUN_JS_TOOL: Tool = {
    name: 'write_and_run_js',
    description: 'Write and execute JavaScript code on the page',
    input_schema: {
        type: 'object' as const,
        properties: {
            js_code: {
                type: 'string',
                description: 'The JavaScript code to execute',
            },
            description: {
                type: 'string',
                description:
                    'A super short human-readable label for what this code does (e.g. "adding the todo item", "checking current colors")',
            },
        },
        required: ['js_code', 'description'],
    },
};

export const EDIT_AND_RUN_JS_TOOL: Tool = {
    name: 'edit_and_run_js',
    description:
        'Edit the most recently executed code using SEARCH/REPLACE blocks and re-run it',
    input_schema: {
        type: 'object' as const,
        properties: {
            edits: {
                type: 'string',
                description:
                    'One or more SEARCH/REPLACE blocks. Use <<<<<<< SEARCH, =======, and >>>>>>> REPLACE markers to specify exact code to find and its replacement.',
            },
            description: {
                type: 'string',
                description:
                    'A super short human-readable label for what this code does (e.g. "fixing the validation", "retrying with correct input")',
            },
        },
        required: ['edits', 'description'],
    },
};
