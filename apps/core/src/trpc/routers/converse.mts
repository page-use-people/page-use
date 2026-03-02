import {z} from 'zod';
import {router, publicProcedure} from '../trpc.mjs';
import {
    assistantBlockSchema,
    userBlockSchema,
} from '#core/trpc/routers/conversation.mjs';

const converseInputSchema = z.object({
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

const converseOutputSchema = z.object({
    blocks: z.array(assistantBlockSchema),
});

export const converseRouter = router({
    converse: publicProcedure
        .input(converseInputSchema)
        .output(converseOutputSchema)
        .mutation(async (_opts) => {
            return {blocks: []};
        }),
});

export type TConverseRouter = typeof converseRouter;
