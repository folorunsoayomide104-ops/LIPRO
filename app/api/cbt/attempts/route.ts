import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/api-guard';
import { examStartSchema } from '@/lib/validators';
import { sampleQuestions, shuffleOptions } from '@/lib/cbt/sampling';
import { MAX_OPEN_ATTEMPTS, MIN_DURATION_SEC, MAX_DURATION_SEC } from '@/lib/cbt/constants';

export const dynamic = 'force-dynamic';

/**
 * Create an exam attempt.
 *
 * Deliberately returns identifiers only — the client immediately calls
 * GET /api/cbt/attempts/[id] to fetch the paper, so "just started" and "resumed"
 * share exactly one code path (and one leak boundary).
 */
export async function POST(req: Request) {
  const { ok, user, response } = await guard();
  if (!ok || !user) return response!;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const parsed = examStartSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 422 });
  }
  const { courseId, materialId, mode, count, durationSec, types } = parsed.data;

  const open = await prisma.examSession.count({
    where: { userId: user.userId, status: 'in_progress' },
  });
  if (open >= MAX_OPEN_ATTEMPTS) {
    return NextResponse.json(
      { error: `You have ${open} unfinished exams. Finish or abandon one before starting another.` },
      { status: 429 }
    );
  }

  let sourceTitle = '';
  if (materialId) {
    // Materials are private, so ownership is enforced here.
    const material = await prisma.material.findFirst({
      where: { id: materialId, userId: user.userId },
      select: { id: true, originalName: true },
    });
    if (!material) return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    sourceTitle = material.originalName;
  } else {
    // Courses are a public catalogue in this app — any signed-in user may practise.
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, title: true },
    });
    if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    sourceTitle = course.title;
  }

  const where: Record<string, unknown> = materialId ? { sourceId: materialId } : { courseId };
  if (types?.length) where.type = { in: types };

  const sampled = await sampleQuestions(where, count);
  if (sampled.length === 0) {
    return NextResponse.json(
      { error: 'No questions available for this selection yet. Generate some questions first.' },
      { status: 422 }
    );
  }

  const totalPoints = sampled.reduce((sum, q) => sum + q.points, 0);
  const defaultDuration = mode === 'exam' ? Math.max(300, sampled.length * 60) : null;
  const resolvedDuration =
    mode === 'exam'
      ? Math.max(MIN_DURATION_SEC, Math.min(MAX_DURATION_SEC, durationSec ?? defaultDuration ?? 600))
      : null;

  const startedAt = new Date();
  const deadlineAt = resolvedDuration ? new Date(startedAt.getTime() + resolvedDuration * 1000) : null;

  const attempt = await prisma.$transaction(async (tx) => {
    const created = await tx.examSession.create({
      data: {
        userId: user.userId,
        courseId: courseId ?? null,
        materialId: materialId ?? null,
        sourceTitle,
        mode,
        status: 'in_progress',
        totalPoints,
        durationSec: resolvedDuration,
        startedAt,
        deadlineAt,
        schemaVersion: 2,
        // Kept in sync for any legacy reader still looking at these columns.
        questionIds: JSON.stringify(sampled.map((q) => q.id)),
      },
    });

    await tx.examAnswer.createMany({
      data: sampled.map((q, i) => ({
        attemptId: created.id,
        questionId: q.id,
        orderIndex: i,
        type: q.type,
        prompt: q.question,
        optionsJson: shuffleOptions(q.options, q.answer),
        imageUrl: q.imageUrl,
        points: q.points,
        correctAnswer: q.answer,
        explanation: q.explanation,
      })),
    });

    return created;
  });

  return NextResponse.json(
    {
      attemptId: attempt.id,
      mode,
      count: sampled.length,
      totalPoints,
      durationSec: resolvedDuration,
      deadlineAt: deadlineAt?.toISOString() ?? null,
      sourceTitle,
    },
    { status: 201 }
  );
}
