import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/api-guard';
import { extractText, MAX_UPLOAD_BYTES } from '@/lib/pdf';
import { chunkText } from '@/lib/chunkText';
import { generateEmbeddings } from '@/lib/embeddings';
import { extractTextFromImage } from '@/lib/ocr';

export const maxDuration = 120;

const ALLOWED_TYPES = ['application/pdf', 'text/plain', 'text/markdown', 'text/csv', 'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/tiff'];
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/tiff'];

async function parseAndCreate(userId: string, buffer: Buffer, originalName: string, mimeType: string, sizeBytes: number) {
  let text = '';
  try {
    if (IMAGE_TYPES.includes(mimeType) || /^image\//.test(mimeType)) {
      text = await extractTextFromImage(buffer);
      if (!text) {
        return { error: 'Could not read any text from this image. Try uploading a clearer image.' };
      }
    } else {
      const result = await extractText(buffer, mimeType);
      text = result.text;
    }
  } catch (err: any) {
    return { error: err?.message || 'Failed to read the document' };
  }

  const material = await prisma.material.create({
    data: {
      userId,
      originalName,
      mimeType,
      sizeBytes,
      status: 'ready',
      text,
    },
    select: {
      id: true,
      originalName: true,
      mimeType: true,
      sizeBytes: true,
      status: true,
      createdAt: true,
    },
  });

  const chunks = chunkText(text);
  if (chunks.length > 0) {
    const texts = chunks.map((c) => c.content);
    try {
      const embeddings = await generateEmbeddings(texts, userId);
      await Promise.all(
        chunks.map(async (chunk, i) => {
          const embedding = embeddings[i] ? Array.from(embeddings[i]) : null;
          if (embedding) {
            const placeholders = embedding.map((_, idx) => `$${idx + 5}`).join(', ');
            await prisma.$executeRawUnsafe(
              `INSERT INTO "DocumentChunk" (id, "materialId", "userId", "chunkIndex", content, embedding, "createdAt") VALUES (gen_random_uuid(), $1, $2, $3, $4, ARRAY[${placeholders}]::vector, NOW())`,
              material.id,
              userId,
              i,
              chunk.content,
              ...embedding
            );
          } else {
            await prisma.$executeRawUnsafe(
              `INSERT INTO "DocumentChunk" (id, "materialId", "userId", "chunkIndex", content, embedding, "createdAt") VALUES (gen_random_uuid(), $1, $2, $3, $4, NULL, NOW())`,
              material.id,
              userId,
              i,
              chunk.content
            );
          }
        })
      );
    } catch (err: any) {
      console.error('Embedding generation failed:', err?.message || err);
    }
  }

  return { material: { ...material, createdAt: material.createdAt.toISOString(), _count: { questions: 0 } } };
}

export async function POST(req: Request) {
  const { ok, user, response } = await guard();
  if (!ok || !user) return response!;

  const contentType = req.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const body = await req.json().catch(() => null);
    if (!body?.blobUrl) return NextResponse.json({ error: 'Missing blobUrl' }, { status: 400 });

    const { blobUrl, originalName = 'document.pdf', sizeBytes = 0 } = body;
    if (sizeBytes > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: 'File is too large. Max size is 100MB.' }, { status: 413 });
    }

    const blobRes = await fetch(blobUrl).catch(() => null);
    if (!blobRes || !blobRes.ok) {
      return NextResponse.json({ error: 'Could not download the uploaded file' }, { status: 422 });
    }
    const buffer = Buffer.from(await blobRes.arrayBuffer());
    if (buffer.length === 0) {
      return NextResponse.json({ error: 'The file is empty.' }, { status: 422 });
    }

    const looksLikePdf = /\.pdf$/i.test(originalName) || body.mimeType === 'application/pdf';
    const looksLikeImage = /^image\//.test(body.mimeType || '') || /\.(jpg|jpeg|png|gif|webp|bmp|tiff|svg)$/i.test(originalName);
    const mimeType = looksLikePdf ? 'application/pdf' : looksLikeImage ? (body.mimeType || 'image/jpeg') : (body.mimeType || 'text/plain');
    const result = await parseAndCreate(user.userId, buffer, originalName, mimeType, sizeBytes || buffer.length);
    if (result.error) return NextResponse.json({ error: result.error }, { status: 422 });
    return NextResponse.json({ material: result.material }, { status: 201 });
  }

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: 'Expected multipart form data' }, { status: 400 });

  const file = form.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });

  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: 'File is too large. Max size is 100MB.' }, { status: 413 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: 'The file is empty.' }, { status: 422 });
  }

  const looksLikePdf = file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf';
  const looksLikeImage = /^image\//.test(file.type) || /\.(jpg|jpeg|png|gif|webp|bmp|tiff|svg)$/.test(file.name.toLowerCase());
  if (!looksLikePdf && !looksLikeImage && !ALLOWED_TYPES.includes(file.type) && !/\.(txt|md|markdown|csv)$/.test(file.name.toLowerCase())) {
    return NextResponse.json({ error: 'Unsupported file type. Upload a PDF, image (JPG, PNG, etc.), TXT or MD file.' }, { status: 415 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = looksLikePdf ? 'application/pdf' : looksLikeImage ? (file.type || 'image/jpeg') : (file.type || 'text/plain');

  const result = await parseAndCreate(user.userId, buffer, file.name, mimeType, file.size);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 422 });
  return NextResponse.json({ material: result.material }, { status: 201 });
}
