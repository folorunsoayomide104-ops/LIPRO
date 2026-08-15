import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/api-guard';
import { canAccess } from '@/lib/auth';
import { examOverrideSchema } from '@/lib/validators';
import { recomputeScore } from '@/lib/cbt/attempt';
import { percentage } from '@/lib/cbt/serialize';

export const dynamic = 'force-dynamic';

/**
 * Lecturer override of a machine-assigned grade.
 *
 * Overridden items carry gradeMethod 'override' and are skipped by any later
 * grading pass, so a re-grade can never undo a human decision.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { ok, user, response } = await guard('LECTURER');
  if (!ok || !user) return response!;
  const { id, itemId } = await params;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  const parsed = examOverrideSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 422 });
  }

  const attempt = await prisma.examSession.findUnique({
    where: { id },
    select: { id: true, status: true, course: { select: { lecturerId: true } } },
  });
  if (!attempt) return NextResponse.json({ error: 'Attempt not found' }, { status: 404 });

  const isLecturer = attempt.course?.lecturerId === user.userId;
  if (!isLecturer && !canAccess('ADMIN', user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (attempt.status === 'in_progress') {
    return NextResponse.json({ error: 'Attempt is still in progress' }, { status: 409 });
  }

  const item = await prisma.examAnswer.findFirst({
    where: { id: itemId, attemptId: attempt.id },
    select: { id: true, points: true },
  });
  if (!item) return NextResponse.json({ error: 'Question not found' }, { status: 404 });

  const awarded = Math.min(parsed.data.awarded, item.points);

  await prisma.examAnswer.update({
    where: { id: item.id },
    data: {
      awarded,
      isCorrect: awarded >= item.points,
      isGraded: true,
      gradeMethod: 'override',
      overriddenBy: user.userId,
      overrideNote: parsed.data.note ?? null,
      overriddenAt: new Date(),
    },
  });

  const { score, totalPoints } = await recomputeScore(attempt.id);

  return NextResponse.json({
    itemId: item.id,
    awarded,
    score,
    totalPoints,
    percentage: percentage(score, totalPoints),
  });
}
