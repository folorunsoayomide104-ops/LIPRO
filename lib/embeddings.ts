import { resolveAiProvider, type AiProviderConfig } from './ai';

const EMBEDDING_DIM = 1536;

/**
 * NVIDIA's QA embedding models are asymmetric (query vs. passage encoders) and
 * reject the request outright without `input_type` — confirmed directly
 * against the live API ("'input_type' parameter is required for asymmetric
 * models"). Callers indexing document chunks should pass 'passage'; callers
 * embedding a search query should pass 'query'.
 */
export type EmbeddingInputType = 'query' | 'passage';

export async function generateEmbedding(text: string, userId: string, inputType: EmbeddingInputType = 'passage'): Promise<Float32Array> {
  const provider = await resolveAiProvider(userId);
  if (provider.provider === 'none' || !provider.apiKey) {
    return new Float32Array(EMBEDDING_DIM);
  }

  const url = `${provider.baseURL}/embeddings`;
  const model = getEmbeddingModel(provider.provider);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify({ model, input: text, ...(provider.provider === 'nvidia' ? { input_type: inputType } : {}) }),
  });

  if (!res.ok) {
    throw new Error(`Embedding request failed: ${res.status}`);
  }

  const data = await res.json();
  const vector: number[] = data?.data?.[0]?.embedding;
  if (!vector || vector.length === 0) {
    throw new Error('Embedding returned empty vector');
  }

  if (vector.length !== EMBEDDING_DIM) {
    console.warn(`[embeddings] provider=${provider.provider} model=${model} returned ${vector.length}-dim vector, expected ${EMBEDDING_DIM} — padding/truncating, similarity quality may degrade.`);
  }

  return padOrTruncate(vector, EMBEDDING_DIM);
}

export async function generateEmbeddings(texts: string[], userId: string, inputType: EmbeddingInputType = 'passage'): Promise<Float32Array[]> {
  const results: Float32Array[] = [];
  for (const text of texts) {
    const emb = await generateEmbedding(text, userId, inputType);
    results.push(emb);
  }
  return results;
}

function getEmbeddingModel(provider: string): string {
  switch (provider) {
    case 'groq':
      return process.env.GROQ_EMBEDDING_MODEL || 'mixedbread-ai/mxbai-embed-large';
    case 'nvidia':
      // nvidia/embed-qa-4 (the previous default) 404s against the live API as
      // of this fix — verified directly. nv-embedqa-e5-v5 is confirmed working.
      return process.env.NVIDIA_EMBEDDING_MODEL || 'nvidia/nv-embedqa-e5-v5';
    default:
      return 'nvidia/nv-embedqa-e5-v5';
  }
}

function padOrTruncate(vec: number[], target: number): Float32Array {
  const result = new Float32Array(target);
  const len = Math.min(vec.length, target);
  for (let i = 0; i < len; i++) {
    result[i] = vec[i];
  }
  return result;
}