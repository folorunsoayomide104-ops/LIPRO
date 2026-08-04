import { resolveAiProvider, type AiProviderConfig } from './ai';

const EMBEDDING_DIM = 1536;

export async function generateEmbedding(text: string, userId: string): Promise<Float32Array> {
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
    body: JSON.stringify({ model, input: text }),
  });

  if (!res.ok) {
    throw new Error(`Embedding request failed: ${res.status}`);
  }

  const data = await res.json();
  const vector: number[] = data?.data?.[0]?.embedding;
  if (!vector || vector.length === 0) {
    throw new Error('Embedding returned empty vector');
  }

  return padOrTruncate(vector, EMBEDDING_DIM);
}

export async function generateEmbeddings(texts: string[], userId: string): Promise<Float32Array[]> {
  const results: Float32Array[] = [];
  for (const text of texts) {
    const emb = await generateEmbedding(text, userId);
    results.push(emb);
  }
  return results;
}

function getEmbeddingModel(provider: string): string {
  switch (provider) {
    case 'groq':
      return process.env.GROQ_EMBEDDING_MODEL || 'mixedbread-ai/mxbai-embed-large';
    case 'nvidia':
      return process.env.NVIDIA_EMBEDDING_MODEL || 'nvidia/embed-qa-4';
    default:
      return 'nvidia/embed-qa-4';
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