import { z } from '@page-use/react';

export const taskSchema = z
    .array(
        z.object({
            id: z.string().describe('unique identifier for the todo item'),
            text: z.string().describe('the todo item description'),
            dueDate: z
                .string()
                .regex(/^($|([0-9]{4}-[0-9]{2}-[0-9]{2}$))/)
                .describe('due date in YYYY-MM-DD format, or empty string if none'),
            completed: z.boolean().describe('whether the item is completed'),
        }),
    )
    .describe('the current list of all todo items');
