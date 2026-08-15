import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/api-guard';
import { resolveAiProvider } from '@/lib/ai';
import { examCheckSchema } from '@/lib/validators';
import { enforceDeadline, loadOwnedAttempt } from '@/lib/cbt/attempt';
import { isFreeText } from '@/lib/cbt/constants';
import { gradeFreeTextBatch, gradeObjective } from '@/lib/cbt/grading';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/**
 * Practice mode "Check answer": grade ONE item and reveal its answer.
 *
 * Replaces the old design where practice mode shipped every correct answer to
 * the browser up front — a student could read the whole key before answering.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ok, user, response } = await guard();
  if (!ok || !user) return response!;
  const { id } = await params;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  const parsed = examCheckSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 422 });
  }

  let attempt = await loadOwnedAttempt(id, user.userId);
  if (!attempt) return NextResponse.json({ error: 'Attempt not found' }, { status: 404 });
  if (attempt.mode !== 'practice') {
    return NextResponse.json({ error: 'Answers can only be checked in practice mode' }, { status: 422 });
  }

  attempt = await enforceDeadline(attempt);
  if (attempt.status !== 'in_progress') {
    return NextResponse.json({ error: 'This attempt is already finished' }, { status: 409 });
  }

  const item = attempt.items.find((i) => i.id === parsed.data.itemId);
  if (!item) return NextResponse.json({ error: 'Question not found' }, { status: 404 });

  const given = parsed.data.response;

  let ratio: number;
  let feedback: string | null = null;
  let method: string;
  let confidence: number | null = null;

  if (isFreeText(item.type)) {
    const [result] = await gradeFreeTextBatch({
      provider: await resolveAiProvider(user.userId),
      items: [
        {
          index: 0,
          type: item.type,
          prompt: item.prompt,
          modelAnswer: item.correctAnswer,
          response: given ?? '',
          points: item.points,
        },
      ],
      deadlineMs: Date.now() + 20000,
    });
    ratio = result?.ratio ?? 0;
    feedback = result?.feedback ?? null;
    method = result?.method ?? 'heuristic';
    confidence = result?.confidence ?? null;
  } else {
    ratio = gradeObjective(item.type, item.correctAnswer, given).ratio;
    method = 'exact';
  }

  const awarded = Math.round(ratio * item.points * 100) / 100;
  const isCorrect = ratio >= 0.999;

  const updated = await prisma.examAnswer.update({
    where: { id: item.id },
    data: {
      response: given,
      answeredAt: given?.trim() ? new Date() : null,
      revealed: true,
      isGraded: true,
      isCorrect,
      awarded,
      gradeMethod: method,
      feedback,
      confidence,
    },
  });

  return NextResponse.json({
    itemId: updated.id,
    isCorrect: updated.isCorrect,
    awarded: updated.awarded,
    points: updated.points,
    correctAnswer: updated.correctAnswer,
    explanation: updated.explanation,
    feedback: updated.feedback,
    gradeMethod: updated.gradeMethod,
  });
}
