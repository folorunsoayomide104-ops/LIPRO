import { NextResponse } from 'next/server';
import { guard } from '@/lib/api-guard';
import { MAX_UPLOAD_BYTES } from '@/lib/pdf';
import { ingestMaterial, type IngestedMaterial } from '@/lib/materials/ingest';
import { isTrustedBlobUrl } from '@/lib/blob-url';

export const maxDuration = 120;

function shapeResponse(material: IngestedMaterial) {
  return { ...material, createdAt: material.createdAt.toISOString(), _count: { questions: 0 } };
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
    if (!isTrustedBlobUrl(blobUrl)) {
      return NextResponse.json({ error: 'Invalid file URL' }, { status: 400 });
    }

    const blobRes = await fetch(blobUrl).catch(() => null);
    if (!blobRes || !blobRes.ok) {
      return NextResponse.json({ error: 'Could not download the uploaded file' }, { status: 422 });
    }
    const buffer = Buffer.from(await blobRes.arrayBuffer());

    const result = await ingestMaterial({
      userId: user.userId,
      buffer,
      originalName,
      declaredMimeType: body.mimeType,
    });
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ material: shapeResponse(result.material) }, { status: 201 });
  }

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: 'Expected multipart form data' }, { status: 400 });

  const file = form.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await ingestMaterial({
    userId: user.userId,
    buffer,
    originalName: file.name,
    declaredMimeType: file.type,
  });
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ material: shapeResponse(result.material) }, { status: 201 });
}
