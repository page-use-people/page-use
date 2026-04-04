export const decodeBase64Embedding = (base64: string): Float32Array => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return new Float32Array(bytes.buffer);
};

export const decodeAllEmbeddings = (
    raw: Record<string, string>,
): ReadonlyMap<string, Float32Array> =>
    new Map(
        Object.entries(raw).map(([id, base64]) => [
            id,
            decodeBase64Embedding(base64),
        ]),
    );

export const cosineSimilarity = (
    a: Float32Array,
    b: Float32Array,
): number => {
    let dot = 0;
    let magA = 0;
    let magB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        magA += a[i] * a[i];
        magB += b[i] * b[i];
    }
    const denom = Math.sqrt(magA) * Math.sqrt(magB);
    return denom === 0 ? 0 : dot / denom;
};
