import {
    pipeline,
    type FeatureExtractionPipeline,
} from '@huggingface/transformers';
import {cosineSimilarity} from './embeddings';

export type TFlatItem = {
    readonly id: string;
    readonly name: string;
    readonly categoryTitle: string;
    readonly subcategoryTitle: string;
    readonly originalPrice: number;
    readonly currentPrice: number;
};

export type TScoredProduct = {
    readonly item: TFlatItem;
    readonly score: number;
};

const QUERY_PREFIX =
    'Represent this sentence for searching relevant passages: ';

let modelPromise: Promise<FeatureExtractionPipeline> | null = null;

export const loadModel = (): Promise<FeatureExtractionPipeline> => {
    if (!modelPromise) {
        modelPromise = (
            pipeline(
                'feature-extraction',
                'mixedbread-ai/mxbai-embed-large-v1',
                {dtype: 'q8'},
            ) as Promise<FeatureExtractionPipeline>
        ).then((model) => {
            console.log('[search] embedding model loaded');
            return model;
        });
    }
    return modelPromise;
};

export const embedQuery = async (query: string): Promise<Float32Array> => {
    const extractor = await loadModel();
    const output = await extractor(QUERY_PREFIX + query, {
        pooling: 'cls',
        normalize: true,
    });
    const nested: number[][] = output.tolist();
    return new Float32Array(nested[0]);
};

export const searchProducts = (
    queryEmbedding: Float32Array,
    items: readonly TFlatItem[],
    embeddings: ReadonlyMap<string, Float32Array>,
): readonly TScoredProduct[] =>
    [...items]
        .flatMap((item) => {
            const vec = embeddings.get(item.id);
            return vec
                ? [{item, score: cosineSimilarity(queryEmbedding, vec)}]
                : [];
        })
        .sort((a, b) => b.score - a.score);
