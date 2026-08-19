import { prisma } from '@/lib/prisma';
import { sampleQuestions, shuffleOptions } from './sampling';
import { MAX_OPEN_ATTEMPTS, MIN_DURATION_SEC, MAX_DURATION_SEC } from './constants';

export interface CreateAttemptParams {
  courseId?: string;
  materialId?: string;
  mode: 'practice' | 'exam';
  count: number;
  durationSec?: number;
  types?: string[];
}

export type CreateAttemptResult =
  | {
      ok: true;
      attemptId: string;
      mode: string;
      count: number;
      totalPoints: number;
      durationSec: number | null;
      deadlineAt: string | null;
      sourceTitle: string;
    }
  | { ok: false; status: 404 | 422 | 429; error: string };

/**
 * Single source of truth for starting a CBT attempt — used by both
 * POST /api/cbt/attempts (the practice/exam picker UI) and the LIPRO AI
 * start_cbt tool, so a chat-initiated attempt goes through the exact same
 * open-attempt cap, sampling, and duration rules as the UI-initiated one.
 */
export async function createExamAttempt(userId: string, params: CreateAttemptParams): Promise<CreateAttemptResult> {
  const { courseId, materialId, mode, durationSec, types } = params;
  const count = Math.max(1, Math.min(100, params.count || 10));

  const open = await prisma.examSession.count({ where: { userId, status: 'in_progress' } });
  if (open >= MAX_OPEN_ATTEMPTS) {
    return { ok: false, status: 429, error: `You have ${open} unfinished exams. Finish or abandon one before starting another.` };
  }

  let sourceTitle = '';
  if (materialId) {
    const material = await prisma.material.findFirst({
      where: { id: materialId, userId },
      select: { id: true, originalName: true },
    });
    if (!material) return { ok: false, status: 404, error: 'Document not found' };
    sourceTitle = material.originalName;
  } else if (courseId) {
    const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true, title: true } });
    if (!course) return { ok: false, status: 404, error: 'Course not found' };
    sourceTitle = course.title;
  } else {
    return { ok: false, status: 422, error: 'Provide exactly one of courseId or materialId' };
  }

  const where: Record<string, unknown> = materialId ? { sourceId: materialId } : { courseId };
  if (types?.length) where.type = { in: types };

  const sampled = await sampleQuestions(where, count);
  if (sampled.length === 0) {
    return { ok: false, status: 422, error: 'No questions available for this selection yet. Generate some questions first.' };
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
        userId,
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

  return {
    ok: true,
    attemptId: attempt.id,
    mode,
    count: sampled.length,
    totalPoints,
    durationSec: resolvedDuration,
    deadlineAt: deadlineAt?.toISOString() ?? null,
    sourceTitle,
  };
}
