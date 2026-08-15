import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/api-guard';
import { examAnswerPatchSchema } from '@/lib/validators';
import { enforceDeadline, loadOwnedAttempt, remainingSec } from '@/lib/cbt/attempt';

export const dynamic = 'force-dynamic';

/**
 * Autosave in-progress answers.
 *
 * Returns `remainingSec` on every save so the client keeps re-syncing its timer
 * against the server rather than trusting a local interval.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ok, user, response } = await guard();
  if (!ok || !user) return response!;
  const { id } = await params;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const parsed = examAnswerPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 422 });
  }

  let attempt = await loadOwnedAttempt(id, user.userId);
  if (!attempt) return NextResponse.json({ error: 'Attempt not found' }, { status: 404 });

  attempt = await enforceDeadline(attempt);
  if (attempt.status !== 'in_progress') {
    // 409 tells the client to stop autosaving and move to the results page.
    return NextResponse.json(
      { error: 'This attempt is already finished', status: attempt.status },
      { status: 409 }
    );
  }

  const now = new Date();
  let saved = 0;
  for (const { itemId, response: value } of parsed.data.items) {
    // The attemptId in the filter IS the authorization check: an item belonging
    // to somebody else's attempt simply matches nothing.
    const res = await prisma.examAnswer.updateMany({
      where: { id: itemId, attemptId: attempt.id, revealed: false },
      data: { response: value, answeredAt: value?.trim() ? now : null },
    });
    saved += res.count;
  }

  return NextResponse.json({
    saved,
    status: attempt.status,
    remainingSec: remainingSec(attempt, now.getTime()),
    serverNow: now.toISOString(),
  });
}
