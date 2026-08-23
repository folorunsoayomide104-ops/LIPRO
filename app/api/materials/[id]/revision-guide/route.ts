import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/api-guard';
import { resolveAiProviders } from '@/lib/ai';
import { generateRevisionGuide, assembleGuideMarkdown, type GeneratedGuidePage } from '@/lib/revision-guide-gen';

export const maxDuration = 300;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ok, user, response } = await guard();
  if (!ok || !user) return response!;
  const { id } = await params;

  const material = await prisma.material.findFirst({ where: { id, userId: user.userId } });
  if (!material) return NextResponse.json({ error: 'Material not found' }, { status: 404 });
  if (!material.text || material.text.trim().length === 0) {
    return NextResponse.json({ error: 'This document has no readable text.' }, { status: 422 });
  }

  const body = await req.json().catch(() => null);
  const save = body?.save === true;
  const requestedCourseId: string | undefined = typeof body?.courseId === 'string' ? body.courseId : undefined;

  // A course is optional — a study document isn't always tied to a formal
  // course, so this only validates one when the caller actually supplied it.
  const courseId: string | null = requestedCourseId ?? material.courseId ?? null;
  if (save && courseId) {
    const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true } });
    if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 });
  }

  const providers = await resolveAiProviders(user.userId);

  // Same reasoning as app/api/materials/[id]/questions/route.ts: this route
  // declares maxDuration = 300 above, so guard generation against that
  // budget (minus headroom), not a stale 60s assumption that was silently
  // forcing real requests into the demo fallback.
  const result = await Promise.race([
    generateRevisionGuide(material.text, material.pageOffsets, providers),
    new Promise<{ pages: GeneratedGuidePage[]; usedFallback: boolean; totalPages: number; truncated: boolean }>((resolve) =>
      setTimeout(() => resolve({ pages: [], usedFallback: true, totalPages: 0, truncated: false }), 280000)
    ),
  ]);

  if (result.pages.length === 0) {
    return NextResponse.json({ error: 'Could not generate a revision guide from this document.' }, { status: 422 });
  }

  const content = assembleGuideMarkdown(result.pages);
  const title = `Revision guide — ${material.originalName}`;

  let noteId: string | null = null;
  if (save) {
    const note = await prisma.note.create({
      data: {
        title,
        content: result.usedFallback ? `[demo]\n\n${content}` : content,
        courseId,
        userId: user.userId,
        tags: 'revision-guide',
      },
    });
    noteId = note.id;
  }

  return NextResponse.json({
    noteId,
    saved: save && !!noteId,
    title,
    content,
    pages: result.pages.map((p) => ({ num: p.num, label: p.label, heading: p.heading, summary: p.summary, keyPoints: p.keyPoints })),
    pageCount: result.pages.length,
    totalPages: result.totalPages,
    truncated: result.truncated,
    usedFallback: result.usedFallback,
  });
}
