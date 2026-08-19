import { resolveNvidiaApiKey, NVIDIA_BASE_URL } from './ai';

const EMBEDDING_DIM = 1536;

/**
 * NVIDIA's QA embedding models are asymmetric (query vs. passage encoders) and
 * reject the request outright without `input_type` — confirmed directly
 * against the live API ("'input_type' parameter is required for asymmetric
 * models"). Callers indexing document chunks should pass 'passage'; callers
 * embedding a search query should pass 'query'.
 */
export type EmbeddingInputType = 'query' | 'passage';

/**
 * Embeddings are resolved independently of the chat provider, not via
 * resolveAiProvider() — Groq has no embeddings endpoint at all (confirmed
 * directly: every embedding request against it 404s), while NVIDIA's
 * dedicated embedding models work fine even on accounts where NVIDIA's chat
 * completions endpoint is unusable. A user who configured Groq for chat
 * still gets working RAG as long as they also have an NVIDIA key on file;
 * a user with only a Groq key gets embeddings skipped gracefully, matching
 * the existing "no provider" behavior, rather than erroring against an
 * endpoint that was never going to work.
 */
export async function generateEmbedding(text: string, userId: string, inputType: EmbeddingInputType = 'passage'): Promise<Float32Array> {
  const apiKey = await resolveNvidiaApiKey(userId);
  if (!apiKey) {
    return new Float32Array(EMBEDDING_DIM);
  }

  const url = `${NVIDIA_BASE_URL}/embeddings`;
  const model = process.env.NVIDIA_EMBEDDING_MODEL || 'nvidia/nv-embedqa-e5-v5';

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, input: text, input_type: inputType }),
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
    console.warn(`[embeddings] model=${model} returned ${vector.length}-dim vector, expected ${EMBEDDING_DIM} — padding/truncating, similarity quality may degrade.`);
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

function padOrTruncate(vec: number[], target: number): Float32Array {
  const result = new Float32Array(target);
  const len = Math.min(vec.length, target);
  for (let i = 0; i < len; i++) {
    result[i] = vec[i];
  }
  return result;
}