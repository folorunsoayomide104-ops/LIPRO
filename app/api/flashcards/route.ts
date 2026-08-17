import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/api-guard';
import { flashcardSchema } from '@/lib/validators';

export async function GET(req: Request) {
  const { ok, user, response } = await guard();
  if (!ok || !user) return response!;
  const url = new URL(req.url);
  const courseId = url.searchParams.get('courseId');
  const materialId = url.searchParams.get('materialId');

  const cards = await prisma.flashcard.findMany({
    where: {
      userId: user.userId,
      ...(courseId ? { courseId } : {}),
      ...(materialId ? { materialId } : {}),
    },
    include: {
      course: { select: { code: true, title: true } },
      material: { select: { originalName: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ cards });
}

export async function POST(req: Request) {
  const { ok, user, response } = await guard();
  if (!ok || !user) return response!;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  const parsed = flashcardSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 422 });

  // Ownership check on the optional course/material links — otherwise a user
  // could file a manually-created card under a course or material they don't
  // own, which is meaningless (and, for materials, would leak that the id
  // exists) rather than dangerous, but there's no reason to allow it.
  if (parsed.data.courseId) {
    const course = await prisma.course.findUnique({ where: { id: parsed.data.courseId }, select: { id: true } });
    if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 });
  }
  if (parsed.data.materialId) {
    const material = await prisma.material.findUnique({ where: { id: parsed.data.materialId }, select: { userId: true } });
    if (!material || material.userId !== user.userId) return NextResponse.json({ error: 'Material not found' }, { status: 404 });
  }

  const card = await prisma.flashcard.create({
    data: {
      front: parsed.data.front,
      back: parsed.data.back,
      courseId: parsed.data.courseId ?? null,
      materialId: parsed.data.materialId ?? null,
      userId: user.userId,
    },
  });
  return NextResponse.json({ card }, { status: 201 });
}
