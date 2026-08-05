import { prisma } from '@/lib/prisma';
import { generateEmbedding } from '@/lib/embeddings';

export type ChunkResult = { id: string; content: string; chunkIndex: number };

export async function fetchRelevantChunks(userId: string, query: string, limit: number = 5): Promise<ChunkResult[]> {
  try {
    const queryEmbedding = Array.from(await generateEmbedding(query, userId));
    if (queryEmbedding.every((v) => v === 0)) return [];
    const embeddingArray = queryEmbedding.map((v) => v.toFixed(6));
    const rows = await prisma.$queryRaw<
      Array<{ id: string; content: string; chunkIndex: number; materialId: string }>
    >`
      SELECT id, content, "chunkIndex", "materialId"
      FROM "DocumentChunk"
      WHERE "userId" = ${userId}
      ORDER BY "embedding" <=> ARRAY[${embeddingArray.join(',')}]::vector
      LIMIT ${limit}
    `;
    return rows.map((r) => ({ id: r.id, content: r.content, chunkIndex: r.chunkIndex }));
  } catch (err: any) {
    console.error('Semantic retrieval failed:', err?.message || err);
    return [];
  }
}

export function buildRagContext(chunks: ChunkResult[]): string {
  if (chunks.length === 0) return '';
  return chunks.map((c) => `[Chunk ${c.chunkIndex}]\n${c.content}`).join('\n\n---\n\n');
}
