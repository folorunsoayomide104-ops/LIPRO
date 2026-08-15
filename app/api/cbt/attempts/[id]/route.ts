import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/api-guard';
import { enforceDeadline, loadOwnedAttempt, remainingSec } from '@/lib/cbt/attempt';
import { toStudentItem } from '@/lib/cbt/serialize';

export const dynamic = 'force-dynamic';

/**
 * Rehydrate an attempt. This is what makes exams survive a refresh, a new tab,
 * or a crash — the paper and every saved answer live in the database, not in
 * the browser's sessionStorage.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ok, user, response } = await guard();
  if (!ok || !user) return response!;
  const { id } = await params;

  let attempt = await loadOwnedAttempt(id, user.userId);
  if (!attempt) return NextResponse.json({ error: 'Attempt not found' }, { status: 404 });

  attempt = await enforceDeadline(attempt);

  // A finished attempt has nothing to run — send the client to the results page.
  if (attempt.status !== 'in_progress') {
    return NextResponse.json({ redirect: 'results', attemptId: attempt.id, status: attempt.status });
  }

  // Best-effort presence marker; never block the response on it.
  prisma.examSession
    .update({ where: { id: attempt.id }, data: { lastSeenAt: new Date() } })
    .catch(() => undefined);

  const now = Date.now();
  const answered = attempt.items.filter((i) => (i.response ?? '').trim().length > 0).length;

  return NextResponse.json({
    attempt: {
      id: attempt.id,
      mode: attempt.mode,
      status: attempt.status,
      sourceTitle: attempt.sourceTitle,
      totalPoints: attempt.totalPoints,
      count: attempt.items.length,
      answeredCount: answered,
      startedAt: attempt.startedAt.toISOString(),
      deadlineAt: attempt.deadlineAt?.toISOString() ?? null,
      durationSec: attempt.durationSec,
      remainingSec: remainingSec(attempt, now),
      // Lets the client correct for a skewed local clock.
      serverNow: new Date(now).toISOString(),
      gradingStatus: attempt.gradingStatus,
    },
    items: attempt.items.map(toStudentItem),
  });
}

/** Abandon an in-progress attempt. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ok, user, response } = await guard();
  if (!ok || !user) return response!;
  const { id } = await params;

  const updated = await prisma.examSession.updateMany({
    where: { id, userId: user.userId, status: 'in_progress' },
    data: { status: 'abandoned', completedAt: new Date() },
  });
  if (updated.count === 0) {
    return NextResponse.json({ error: 'No in-progress attempt to abandon' }, { status: 404 });
  }
  return NextResponse.json({ ok: true, status: 'abandoned' });
}
