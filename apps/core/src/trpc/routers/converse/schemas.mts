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
export const MAX_CONSECUTIVE_PATCH_FAILURES = 3;
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
        },
        required: ['js_code'],
    },
};

export const PATCH_AND_RUN_JS_TOOL: Tool = {
    name: 'patch_and_run_js',
    description:
        'Apply a unified diff patch to the most recently executed code and re-run it',
    input_schema: {
        type: 'object' as const,
        properties: {
            js_code_diff_patch: {
                type: 'string',
                description:
                    'A unified diff patch to apply to the previous code',
            },
        },
        required: ['js_code_diff_patch'],
    },
};
