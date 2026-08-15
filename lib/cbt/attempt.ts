import type { ExamAnswer, ExamSession } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { isFreeText, SUBMIT_GRACE_SEC } from './constants';
import { gradeObjective } from './grading';
import { percentage } from './serialize';

export type AttemptWithItems = ExamSession & { items: ExamAnswer[] };

export async function loadOwnedAttempt(id: string, userId: string): Promise<AttemptWithItems | null> {
  const attempt = await prisma.examSession.findFirst({
    where: { id, userId },
    include: { items: { orderBy: { orderIndex: 'asc' } } },
  });
  return attempt;
}

export function remainingSec(attempt: ExamSession, now = Date.now()): number | null {
  if (!attempt.deadlineAt) return null;
  return Math.max(0, Math.round((attempt.deadlineAt.getTime() - now) / 1000));
}

export function isExpired(attempt: ExamSession, now = Date.now()): boolean {
  if (!attempt.deadlineAt) return false;
  return now > attempt.deadlineAt.getTime() + SUBMIT_GRACE_SEC * 1000;
}

/**
 * Grade every objective item, persist the score, and mark the attempt complete.
 *
 * Idempotent: the status guard in `updateMany` means a concurrent or repeated
 * call is a no-op and the already-persisted result is returned instead. Free-text
 * items are left ungraded here and picked up by the AI grading pass, so a submit
 * never blocks on an LLM call.
 */
export async function finalizeAttempt(
  attemptId: string,
  opts: { auto?: boolean } = {}
): Promise<AttemptWithItems | null> {
  const attempt = await prisma.examSession.findUnique({
    where: { id: attemptId },
    include: { items: { orderBy: { orderIndex: 'asc' } } },
  });
  if (!attempt) return null;
  if (attempt.status === 'completed') return attempt;

  // Claim the attempt. count === 0 means someone else finalized it first.
  const claim = await prisma.examSession.updateMany({
    where: { id: attemptId, status: 'in_progress' },
    data: { status: 'completed', completedAt: new Date(), autoSubmitted: !!opts.auto },
  });
  if (claim.count === 0) {
    return prisma.examSession.findUnique({
      where: { id: attemptId },
      include: { items: { orderBy: { orderIndex: 'asc' } } },
    });
  }

  let earned = 0;
  let hasFreeText = false;
  const updates: Array<Promise<unknown>> = [];

  for (const item of attempt.items) {
    if (isFreeText(item.type)) {
      hasFreeText = true;
      continue;
    }
    if (item.isGraded) {
      earned += item.awarded;
      continue;
    }
    const { isCorrect } = gradeObjective(item.type, item.correctAnswer, item.response);
    const awarded = isCorrect ? item.points : 0;
    earned += awarded;
    updates.push(
      prisma.examAnswer.update({
        where: { id: item.id },
        data: { isGraded: true, isCorrect, awarded, gradeMethod: 'exact' },
      })
    );
  }
  await Promise.all(updates);

  const totalPoints = attempt.items.reduce((sum, i) => sum + i.points, 0);
  const gradingStatus = hasFreeText ? 'pending' : 'complete';

  const updated = await prisma.examSession.update({
    where: { id: attemptId },
    data: {
      score: earned,
      totalPoints,
      gradingStatus,
      gradedAt: hasFreeText ? null : new Date(),
    },
    include: { items: { orderBy: { orderIndex: 'asc' } } },
  });

  // Notification lives here (not in the route) so auto-submitted attempts notify too.
  const label = attempt.sourceTitle || 'your exam';
  const pct = percentage(earned, totalPoints);
  await prisma.notification
    .create({
      data: {
        userId: attempt.userId,
        type: 'ACADEMIC',
        title: 'CBT session completed',
        message: hasFreeText
          ? `You scored ${earned} / ${totalPoints} so far in ${label}. Written answers are still being graded.`
          : `You scored ${earned} / ${totalPoints} (${pct}%) in ${label}.`,
      },
    })
    .catch((err) => console.error('CBT notification failed:', err?.message || err));

  return updated;
}

/**
 * Auto-submit an attempt whose deadline has passed. Called at the top of every
 * attempt route — this is what makes the timer server-enforced without a cron.
 */
export async function enforceDeadline(attempt: AttemptWithItems): Promise<AttemptWithItems> {
  if (attempt.status !== 'in_progress') return attempt;
  if (!attempt.deadlineAt || Date.now() <= attempt.deadlineAt.getTime()) return attempt;
  const finalized = await finalizeAttempt(attempt.id, { auto: true });
  return finalized ?? attempt;
}

/** Recompute the attempt score from its items (after AI grading or an override). */
export async function recomputeScore(attemptId: string): Promise<{ score: number; totalPoints: number }> {
  const items = await prisma.examAnswer.findMany({
    where: { attemptId },
    select: { awarded: true, points: true },
  });
  const score = items.reduce((s, i) => s + i.awarded, 0);
  const totalPoints = items.reduce((s, i) => s + i.points, 0);
  await prisma.examSession.update({ where: { id: attemptId }, data: { score, totalPoints } });
  return { score, totalPoints };
}
