import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/api-guard';
import { extractText, MAX_UPLOAD_BYTES } from '@/lib/pdf';

export const maxDuration = 120;

export async function POST(req: Request) {
  const { ok, user, response } = await guard();
  if (!ok || !user) return response!;

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

  const allowedTypes = ['application/pdf', 'text/plain', 'text/markdown', 'text/csv'];
  const looksLikePdf = file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf';
  if (!looksLikePdf && !allowedTypes.includes(file.type) && !/\.(txt|md|markdown|csv)$/.test(file.name.toLowerCase())) {
    return NextResponse.json({ error: 'Unsupported file type. Upload a PDF, TXT or MD file.' }, { status: 415 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = looksLikePdf ? 'application/pdf' : (file.type || 'text/plain');

  let text = '';
  try {
    const result = await extractText(buffer, mimeType);
    text = result.text;
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to read the document' }, { status: 422 });
  }

  const material = await prisma.material.create({
    data: {
      userId: user.userId,
      originalName: file.name,
      mimeType,
      sizeBytes: file.size,
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

  return NextResponse.json({ material: { ...material, createdAt: material.createdAt.toISOString(), _count: { questions: 0 } } }, { status: 201 });
}
