import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/api-guard';
import { finalizeAttempt, loadOwnedAttempt } from '@/lib/cbt/attempt';
import { percentage } from '@/lib/cbt/serialize';

export const dynamic = 'force-dynamic';

/**
 * @deprecated Superseded by POST /api/cbt/attempts/[id]/submit. Kept as a thin
 * wrapper for one release: maps the old {sessionId, answers} shape onto the
 * new attempt, applies posted answers as a final flush, and grades it exactly
 * as before — including running AI grading synchronously here (the old route
 * had no separate grading step, and a stale client won't poll one).
 */
export async function POST(req: Request) {
  const { ok, user, response } = await guard();
  if (!ok || !user) return response!;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  const { sessionId, answers } = body as { sessionId?: string; answers?: Record<string, string> };
  if (!sessionId || !answers) return NextResponse.json({ error: 'sessionId and answers required' }, { status: 422 });

  const attempt = await loadOwnedAttempt(sessionId, user.userId);
  if (!attempt) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

  if (attempt.status === 'in_progress') {
    const now = new Date();
    for (const item of attempt.items) {
      const value = item.questionId ? answers[item.questionId] : undefined;
      if (value === undefined) continue;
      await prisma.examAnswer.updateMany({
        where: { id: item.id, attemptId: attempt.id },
        data: { response: value, answeredAt: value.trim() ? now : null },
      });
    }
  }

  const finalized = await finalizeAttempt(attempt.id);
  if (!finalized) return NextResponse.json({ error: 'Could not submit attempt' }, { status: 500 });

  // Old callers expect grading to be finished by the time this responds.
  const { runGrading } = await import('@/lib/cbt/grade-runner');
  const hasFreeText = finalized.items.some((i) => !i.isGraded);
  const graded = hasFreeText ? await runGrading(finalized.id) : null;

  const items = graded
    ? await prisma.examAnswer.findMany({ where: { attemptId: finalized.id }, orderBy: { orderIndex: 'asc' } })
    : finalized.items;

  const score = graded?.score ?? finalized.score ?? 0;
  const totalPoints = graded?.totalPoints ?? finalized.totalPoints ?? 0;

  const breakdown = items.map((item) => ({
    questionId: item.questionId,
    question: item.prompt,
    type: item.type,
    options: item.optionsJson,
    yourAnswer: item.response ?? '',
    correctAnswer: item.correctAnswer,
    isCorrect: item.isCorrect,
    explanation: item.explanation,
    points: item.points,
  }));

  return NextResponse.json(
    { sessionId: finalized.id, score, totalPoints, percentage: percentage(score, totalPoints), breakdown },
    { headers: { Deprecation: 'true', Link: '</api/cbt/attempts>; rel="successor-version"' } }
  );
}
