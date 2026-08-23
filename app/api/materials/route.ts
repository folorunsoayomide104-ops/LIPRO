import { NextResponse } from 'next/server';
import { guard } from '@/lib/api-guard';
import { canAccess } from '@/lib/auth';
import { MAX_UPLOAD_BYTES } from '@/lib/pdf';
import { ingestMaterial, type IngestedMaterial } from '@/lib/materials/ingest';
import { isTrustedBlobUrl } from '@/lib/blob-url';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';

// 120s was too tight for a real scanned multi-page PDF going through OCR —
// confirmed directly against production (a 3.5MB scanned document timed
// out mid-upload). Matches the CBT questions route's proven-working
// ceiling on this same Vercel plan.
export const maxDuration = 300;

function shapeResponse(material: IngestedMaterial) {
  return { ...material, createdAt: material.createdAt.toISOString(), _count: { questions: 0 } };
}

/**
 * Attaching a material to a course (as opposed to a student's own private
 * upload) makes it visible to everyone browsing that course, so only an
 * admin can do it — otherwise any authenticated user could post files into
 * a course they don't manage.
 */
/** Returns an error NextResponse if courseId is present but invalid/unauthorized, otherwise null. */
function courseIdError(role: string, courseId: unknown): NextResponse | null {
  if (!courseId) return null;
  if (typeof courseId !== 'string') return NextResponse.json({ error: 'Invalid courseId' }, { status: 422 });
  if (!canAccess('ADMIN', role as any)) {
    return NextResponse.json({ error: 'Only an admin can attach a material to a course' }, { status: 403 });
  }
  return null;
}

export async function POST(req: Request) {
  const { ok, user, response } = await guard();
  if (!ok || !user) return response!;

  // Each upload runs real text extraction and, for scanned PDFs, per-page
  // vision-model OCR calls plus embedding calls — all paid AI usage. Cap
  // per-user volume so repeated large uploads can't run up the bill.
  const uploadLimit = await checkRateLimit(`materials-upload:${user.userId}`, 60 * 60 * 1000, 20);
  if (!uploadLimit.ok) return rateLimitResponse(uploadLimit);

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

    const courseIdErr = courseIdError(user.role, body.courseId);
    if (courseIdErr) return courseIdErr;
    const courseId = typeof body.courseId === 'string' ? body.courseId : null;

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
      courseId,
    });
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ material: shapeResponse(result.material) }, { status: 201 });
  }

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: 'Expected multipart form data' }, { status: 400 });

  const file = form.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });

  const rawCourseId = form.get('courseId');
  const courseIdErr = courseIdError(user.role, rawCourseId);
  if (courseIdErr) return courseIdErr;
  const courseId = typeof rawCourseId === 'string' ? rawCourseId : null;

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await ingestMaterial({
    userId: user.userId,
    buffer,
    originalName: file.name,
    declaredMimeType: file.type,
    courseId,
  });
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ material: shapeResponse(result.material) }, { status: 201 });
}
