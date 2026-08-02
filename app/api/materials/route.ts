import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/api-guard';
import { extractText, MAX_UPLOAD_BYTES } from '@/lib/pdf';

export const maxDuration = 120;

const ALLOWED_TYPES = ['application/pdf', 'text/plain', 'text/markdown', 'text/csv'];

async function parseAndCreate(userId: string, buffer: Buffer, originalName: string, mimeType: string, sizeBytes: number) {
  let text = '';
  try {
    const result = await extractText(buffer, mimeType);
    text = result.text;
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
    const mimeType = looksLikePdf ? 'application/pdf' : (body.mimeType || 'text/plain');
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
  if (!looksLikePdf && !ALLOWED_TYPES.includes(file.type) && !/\.(txt|md|markdown|csv)$/.test(file.name.toLowerCase())) {
    return NextResponse.json({ error: 'Unsupported file type. Upload a PDF, TXT or MD file.' }, { status: 415 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = looksLikePdf ? 'application/pdf' : (file.type || 'text/plain');

  const result = await parseAndCreate(user.userId, buffer, file.name, mimeType, file.size);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 422 });
  return NextResponse.json({ material: result.material }, { status: 201 });
}
