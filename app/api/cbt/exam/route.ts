import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/api-guard';

export async function POST(req: Request) {
  const { ok, user, response } = await guard();
  if (!ok || !user) return response!;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const { courseId, materialId, mode, count, durationSec } = body as {
    courseId?: string;
    materialId?: string;
    mode: 'practice' | 'exam';
    count?: number;
    durationSec?: number;
  };
  if (!mode || !['practice', 'exam'].includes(mode)) return NextResponse.json({ error: 'mode required (practice or exam)' }, { status: 422 });
  if (!courseId && !materialId) return NextResponse.json({ error: 'courseId or materialId required' }, { status: 422 });
  const num = Math.max(1, Math.min(50, count || 10));

  let title = '';
  let courseIdToStore: string | null = null;

  if (materialId) {
    const material = await prisma.material.findFirst({ where: { id: materialId, userId: user.userId } });
    if (!material) return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    const qCount = await prisma.question.count({ where: { sourceId: materialId } });
    if (qCount === 0) return NextResponse.json({ error: 'No questions have been generated for this document yet. Generate questions first.' }, { status: 422 });
    title = material.originalName;
  } else {
    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    title = course.title;
    courseIdToStore = courseId!;
  }

  const all = await prisma.question.findMany({
    where: materialId ? { sourceId: materialId } : { courseId: courseIdToStore },
    orderBy: { createdAt: 'asc' },
  });
  if (all.length === 0) return NextResponse.json({ error: 'No questions available' }, { status: 422 });

  const shuffled = [...all].sort(() => Math.random() - 0.5).slice(0, Math.min(num, all.length));

  const questions = shuffled.map((q) => ({
    id: q.id,
    type: q.type,
    question: q.question,
    options: q.options,
    imageUrl: q.imageUrl,
    points: q.points,
    ...(mode === 'practice' ? { answer: q.answer, explanation: q.explanation } : {}),
  }));

  const totalPoints = shuffled.reduce((s, q) => s + q.points, 0);
  const defaultDuration = mode === 'exam' ? Math.max(300, shuffled.length * 60) : null;
  const parsedDuration = durationSec ? Math.max(60, Math.min(10800, Math.round(durationSec))) : defaultDuration;

  const session = await prisma.examSession.create({
    data: {
      userId: user.userId,
      courseId: courseIdToStore,
      mode,
      totalPoints,
      durationSec: parsedDuration,
      questionIds: JSON.stringify(shuffled.map((q) => q.id)),
    },
  });

  return NextResponse.json({ sessionId: session.id, questions, totalPoints, durationSec: session.durationSec, sourceTitle: title });
}
