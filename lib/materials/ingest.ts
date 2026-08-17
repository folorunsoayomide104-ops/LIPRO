import { prisma } from '@/lib/prisma';
import { extractText, isDocxName, DOCX_MIME, MAX_UPLOAD_BYTES } from '@/lib/pdf';
import { extractTextFromImage } from '@/lib/ocr';
import { chunkText } from '@/lib/chunkText';
import { generateEmbeddings } from '@/lib/embeddings';
import { resolveAiProvider, type AiProviderConfig } from '@/lib/ai';

/**
 * Single entry point for turning an uploaded file into a searchable Material.
 *
 * Replaces four near-identical copies of this logic that had drifted from each
 * other (three in the chat route, two in the materials route): inconsistent
 * type validation, inconsistent failure handling, and — the one that mattered —
 * only two of those five call sites actually chunked + embedded the result, so
 * documents attached inline in a chat message were never RAG-searchable.
 * Every caller now goes through here, so every Material gets embedded.
 */

const TEXT_EXTENSIONS = /\.(txt|md|markdown|csv)$/i;
const IMAGE_EXTENSIONS = /\.(jpe?g|png|gif|webp|bmp|tiff?|svg)$/i;

export interface MimeInfo {
  mimeType: string;
  isImage: boolean;
  isPdf: boolean;
  isDocx: boolean;
  isTextLike: boolean;
}

/** Centralizes the looksLikePdf/looksLikeImage/looksLikeDocx heuristics previously copy-pasted per call site. */
export function resolveMimeType(originalName: string, declaredMimeType: string | undefined, buffer: Buffer): MimeInfo {
  const declared = (declaredMimeType || '').toLowerCase();
  const isPdf = /\.pdf$/i.test(originalName) || declared === 'application/pdf' || buffer.subarray(0, 5).toString('latin1') === '%PDF-';
  const isImage = !isPdf && (/^image\//.test(declared) || IMAGE_EXTENSIONS.test(originalName));
  const isDocx = !isPdf && !isImage && (isDocxName(originalName) || declared === DOCX_MIME);
  const isTextLike = !isPdf && !isImage && !isDocx && (declared.startsWith('text/') || TEXT_EXTENSIONS.test(originalName));

  const mimeType = isPdf
    ? 'application/pdf'
    : isDocx
      ? DOCX_MIME
      : isImage
        ? (declared.startsWith('image/') ? declared : 'image/jpeg')
        : declared || 'text/plain';

  return { mimeType, isImage, isPdf, isDocx, isTextLike };
}

export interface IngestMaterialParams {
  userId: string;
  buffer: Buffer;
  originalName: string;
  /** Advisory only — resolveMimeType() re-derives from name/bytes regardless. */
  declaredMimeType?: string;
  courseId?: string | null;
  /** Pass an already-resolved provider to skip a redundant resolveAiProvider() call. */
  provider?: AiProviderConfig;
}

export interface IngestedMaterial {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  status: string;
  text: string;
  createdAt: Date;
}

export type IngestMaterialResult =
  | { ok: true; material: IngestedMaterial; chunkCount: number; embeddedChunkCount: number }
  | { ok: false; status: 413 | 415 | 422; error: string };

export async function ingestMaterial(params: IngestMaterialParams): Promise<IngestMaterialResult> {
  const { userId, buffer, originalName, declaredMimeType, courseId } = params;

  if (buffer.length > MAX_UPLOAD_BYTES) {
    return { ok: false, status: 413, error: 'File is too large. Max size is 100MB.' };
  }
  if (buffer.length === 0) {
    return { ok: false, status: 422, error: 'The file is empty.' };
  }

  const info = resolveMimeType(originalName, declaredMimeType, buffer);
  if (!info.isPdf && !info.isDocx && !info.isImage && !info.isTextLike) {
    return {
      ok: false,
      status: 415,
      error: 'Unsupported file type. Upload a PDF, Word (.docx), image (JPG, PNG, etc.), TXT or MD file.',
    };
  }

  let text: string;
  let pageOffsets: number[] = [];
  try {
    if (info.isImage) {
      text = await extractTextFromImage(buffer, userId);
    } else {
      const extracted = await extractText(buffer, info.mimeType);
      text = extracted.text;
      pageOffsets = extracted.pageOffsets ?? [];
    }
  } catch (err: any) {
    return { ok: false, status: 422, error: err?.message || 'Failed to read the file' };
  }
  if (!text) {
    return { ok: false, status: 422, error: 'No readable text found in this file.' };
  }

  const material = await prisma.material.create({
    data: {
      userId,
      courseId: courseId ?? null,
      originalName,
      mimeType: info.mimeType,
      sizeBytes: buffer.length,
      status: 'ready',
      text,
      pageOffsets,
    },
  });

  let embeddedChunkCount = 0;
  const chunks = chunkText(text);
  if (chunks.length > 0) {
    const provider = params.provider ?? (await resolveAiProvider(userId));
    const hasEmbeddingProvider = provider.provider !== 'none' && !!provider.apiKey.trim();

    // DocumentChunk.embedding is NOT NULL at the database level (verified
    // against the actual schema — confirmed by a real 23502 constraint
    // violation while testing this). A chunk with no embedding is also
    // useless for its only purpose (vector similarity search), so on any
    // embedding failure the chunk is simply not inserted, rather than
    // inserted as an unsearchable placeholder row that the DB would reject
    // anyway.
    let embeddings: Float32Array[] | null = null;
    if (hasEmbeddingProvider) {
      try {
        embeddings = await generateEmbeddings(chunks.map((c) => c.content), userId, 'passage');
      } catch (err: any) {
        console.error('Embedding generation failed, chunks will not be searchable:', err?.message || err);
      }
    }

    if (embeddings) {
      const embeddingsResolved = embeddings;
      await Promise.all(
        chunks.map(async (chunk, i) => {
          const embedding = Array.from(embeddingsResolved[i]);
          embeddedChunkCount++;
          const placeholders = embedding.map((_, idx) => `$${idx + 5}`).join(', ');
          await prisma.$executeRawUnsafe(
            `INSERT INTO "DocumentChunk" (id, "materialId", "userId", "chunkIndex", content, embedding, "createdAt") VALUES (gen_random_uuid(), $1, $2, $3, $4, ARRAY[${placeholders}]::vector, NOW())`,
            material.id,
            userId,
            i,
            chunk.content,
            ...embedding
          );
        })
      );
    }
  }

  return {
    ok: true,
    material: {
      id: material.id,
      originalName: material.originalName,
      mimeType: material.mimeType,
      sizeBytes: material.sizeBytes,
      status: material.status,
      text: material.text ?? '',
      createdAt: material.createdAt,
    },
    chunkCount: chunks.length,
    embeddedChunkCount,
  };
}
