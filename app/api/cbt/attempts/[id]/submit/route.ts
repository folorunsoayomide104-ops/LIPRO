import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/api-guard';
import { examSubmitSchema } from '@/lib/validators';
import { finalizeAttempt, isExpired, loadOwnedAttempt } from '@/lib/cbt/attempt';
import { isFreeText } from '@/lib/cbt/constants';
import { percentage } from '@/lib/cbt/serialize';

export const dynamic = 'force-dynamic';

function summarize(attempt: { id: string; status: string; score: number | null; totalPoints: number | null; gradingStatus: string; autoSubmitted: boolean }, pendingFreeText: number) {
  return {
    attemptId: attempt.id,
    status: attempt.status,
    score: attempt.score ?? 0,
    totalPoints: attempt.totalPoints ?? 0,
    percentage: percentage(attempt.score, attempt.totalPoints),
    gradingStatus: attempt.gradingStatus,
    autoSubmitted: attempt.autoSubmitted,
    pendingFreeText,
  };
}

/**
 * Finalize an attempt. Objective questions are graded synchronously; free-text
 * answers are left for POST .../grade so a submit never blocks on an LLM call.
 *
 * Idempotent — resubmitting returns the persisted result rather than erroring,
 * so a double-click can't destroy a score.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ok, user, response } = await guard();
  if (!ok || !user) return response!;
  const { id } = await params;

  const body = await req.json().catch(() => ({}));
  const parsed = examSubmitSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 422 });
  }

  const attempt = await loadOwnedAttempt(id, user.userId);
  if (!attempt) return NextResponse.json({ error: 'Attempt not found' }, { status: 404 });

  if (attempt.status !== 'in_progress') {
    const pending = attempt.items.filter((i) => isFreeText(i.type) && !i.isGraded).length;
    return NextResponse.json(summarize(attempt, pending));
  }

  // Past the deadline (plus grace), the posted answers are discarded and only
  // what was autosaved counts. Otherwise apply the final flush.
  const expired = isExpired(attempt);
  if (!expired && parsed.data.items?.length) {
    const now = new Date();
    for (const { itemId, response: value } of parsed.data.items) {
      await prisma.examAnswer.updateMany({
        where: { id: itemId, attemptId: attempt.id, revealed: false },
        data: { response: value, answeredAt: value?.trim() ? now : null },
      });
    }
  }

  const finalized = await finalizeAttempt(attempt.id, { auto: expired });
  if (!finalized) return NextResponse.json({ error: 'Could not submit attempt' }, { status: 500 });

  const pending = finalized.items.filter((i) => isFreeText(i.type) && !i.isGraded).length;
  return NextResponse.json(summarize(finalized, pending));
}
