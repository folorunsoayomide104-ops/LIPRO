import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/api-guard';
import { resolveAiProvider, AI_FEATURES_ENABLED } from '@/lib/ai';
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

  let feedback: string | null = null;
  let method: string;
  let confidence: number | null = null;

  let isGraded = true;
  let isCorrect = false;
  let awarded = 0;

  if (isFreeText(item.type) && !AI_FEATURES_ENABLED) {
    // AI grading is off for launch — leave this genuinely ungraded rather
    // than silently auto-scoring it with the heuristic fallback. A student
    // still sees the model answer/explanation for reference, just no
    // correct/incorrect verdict or awarded points until an admin grades it.
    isGraded = false;
    method = 'ungraded';
    feedback = 'This answer needs manual review — theory/essay grading is currently disabled.';
  } else if (isFreeText(item.type)) {
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
    const ratio = result?.ratio ?? 0;
    feedback = result?.feedback ?? null;
    method = result?.method ?? 'heuristic';
    confidence = result?.confidence ?? null;
    awarded = Math.round(ratio * item.points * 100) / 100;
    isCorrect = ratio >= 0.999;
  } else {
    const ratio = gradeObjective(item.type, item.correctAnswer, given).ratio;
    method = 'exact';
    awarded = Math.round(ratio * item.points * 100) / 100;
    isCorrect = ratio >= 0.999;
  }

  const updated = await prisma.examAnswer.update({
    where: { id: item.id },
    data: {
      response: given,
      answeredAt: given?.trim() ? new Date() : null,
      revealed: true,
      isGraded,
      isCorrect: isGraded ? isCorrect : null,
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
