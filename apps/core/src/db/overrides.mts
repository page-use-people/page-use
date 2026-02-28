export const inferenceAPIs = ['anthropic'] as const;
export type TInferenceAPI = (typeof inferenceAPIs)[number];
