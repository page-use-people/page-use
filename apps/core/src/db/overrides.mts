export const inferenceAPIs = ['anthropic'] as const;
export type TInferenceAPI = (typeof inferenceAPIs)[number];

export const conversationActors = ['user', 'assistant'] as const;
export type TConversationActor = (typeof conversationActors)[number];

export const conversationModels = [
    'claude-sonnet-4.6',
    'claude-opus-4.6',
] as const;
export type TConversationModel = (typeof conversationModels)[number];

export const blockTypes = [
    'text',
    'tool_use',
    'tool_result',
    'thinking',
    'redacted_thinking',
] as const;
export type TBlockType = (typeof blockTypes)[number];
