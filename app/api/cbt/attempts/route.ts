import { NextResponse } from 'next/server';
import { guard } from '@/lib/api-guard';
import { examStartSchema } from '@/lib/validators';
import { createExamAttempt, type CreateAttemptResult } from '@/lib/cbt/create-attempt';

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
  const result: CreateAttemptResult = await createExamAttempt(user.userId, { courseId, materialId, mode, count, durationSec, types });
  if (result.ok === false) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const { ok: _ok, ...body2 } = result;
  return NextResponse.json(body2, { status: 201 });
}
