import { prisma } from '@/lib/prisma';
import { generateEmbedding } from '@/lib/embeddings';

export type ChunkResult = { id: string; content: string; chunkIndex: number };

export async function fetchRelevantChunks(userId: string, query: string, limit: number = 5): Promise<ChunkResult[]> {
  try {
    const queryEmbedding = Array.from(await generateEmbedding(query, userId, 'query'));
    if (queryEmbedding.every((v) => v === 0)) return [];
    // pgvector's text input format is a bracketed literal like '[1,2,3]' cast
    // to ::vector — NOT Postgres's ARRAY[] constructor. The previous version
    // joined all floats into one string and wrapped it in ARRAY[...], which
    // Prisma bound as a single parameter — producing a one-element text[]
    // ("cannot cast type text[] to vector"), not a real vector. This always
    // failed whenever a real embedding was generated; the try/catch below
    // silently swallowed it and returned no results instead of crashing.
    const vectorLiteral = `[${queryEmbedding.map((v) => v.toFixed(6)).join(',')}]`;
    const rows = await prisma.$queryRaw<
      Array<{ id: string; content: string; chunkIndex: number; materialId: string }>
    >`
      SELECT id, content, "chunkIndex", "materialId"
      FROM "DocumentChunk"
      WHERE "userId" = ${userId}
      ORDER BY "embedding" <=> ${vectorLiteral}::vector
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
