import { prisma } from '@/lib/prisma';
import { resolveAiProvider, AI_FEATURES_ENABLED } from '@/lib/ai';
import { GRADE_BUDGET_MS, isFreeText } from './constants';
import { gradeFreeTextBatch, type GradableItem } from './grading';
import { recomputeScore } from './attempt';

export type GradeOutcome = {
  gradingStatus: string;
  graded: number;
  score: number;
  totalPoints: number;
};

/**
 * Grade an attempt's free-text answers with AI, falling back to the heuristic
 * scorer for anything the model can't handle.
 *
 * Claims the attempt first, so a duplicate call (client retry + cron sweep
 * racing, say) is a no-op rather than double work. Never throws: on an
 * unexpected failure the attempt is reset to `failed` so it can be retried.
 */
export async function runGrading(attemptId: string): Promise<GradeOutcome | null> {
  const claim = await prisma.examSession.updateMany({
    where: { id: attemptId, status: 'completed', gradingStatus: { in: ['pending', 'failed'] } },
    data: { gradingStatus: 'grading' },
  });

  const attempt = await prisma.examSession.findUnique({
    where: { id: attemptId },
    include: { items: { orderBy: { orderIndex: 'asc' } } },
  });
  if (!attempt) return null;

  // Someone else is already grading (or it's done) — report current state.
  if (claim.count === 0) {
    return {
      gradingStatus: attempt.gradingStatus,
      graded: attempt.items.filter((i) => i.isGraded).length,
      score: attempt.score ?? 0,
      totalPoints: attempt.totalPoints ?? 0,
    };
  }

  try {
    // Overridden items are authoritative — never re-grade them.
    const pending = attempt.items.filter(
      (i) => isFreeText(i.type) && !i.overriddenBy && !i.isGraded
    );

    if (pending.length === 0) {
      const { score, totalPoints } = await recomputeScore(attempt.id);
      await prisma.examSession.update({
        where: { id: attempt.id },
        data: { gradingStatus: 'complete', gradedAt: new Date() },
      });
      return { gradingStatus: 'complete', graded: 0, score, totalPoints };
    }

    if (!AI_FEATURES_ENABLED) {
      // Leave these genuinely ungraded rather than silently auto-scoring
      // with the heuristic fallback — mark them explicitly so results pages
      // can tell "pending manual review" apart from "answered nothing".
      await Promise.all(
        pending.map((item) =>
          prisma.examAnswer.update({
            where: { id: item.id },
            data: { gradeMethod: 'ungraded', feedback: 'Awaiting manual review — theory/essay grading is currently disabled.' },
          })
        )
      );
      const { score, totalPoints } = await recomputeScore(attempt.id);
      await prisma.examSession.update({
        where: { id: attempt.id },
        data: { gradingStatus: 'pending', gradedAt: new Date() },
      });
      return { gradingStatus: 'pending', graded: 0, score, totalPoints };
    }

    const provider = await resolveAiProvider(attempt.userId);
    const gradable: GradableItem[] = pending.map((item, index) => ({
      index,
      type: item.type,
      prompt: item.prompt,
      modelAnswer: item.correctAnswer,
      response: item.response ?? '',
      points: item.points,
    }));

    const results = await gradeFreeTextBatch({
      provider,
      items: gradable,
      deadlineMs: Date.now() + GRADE_BUDGET_MS,
    });

    let usedHeuristic = false;
    await Promise.all(
      results.map((r) => {
        const item = pending[r.index];
        if (!item) return Promise.resolve();
        if (r.method === 'heuristic') usedHeuristic = true;
        const awarded = Math.round(r.ratio * item.points * 100) / 100;
        return prisma.examAnswer.update({
          where: { id: item.id },
          data: {
            isGraded: true,
            isCorrect: r.ratio >= 0.999,
            awarded,
            gradeMethod: r.method,
            feedback: r.feedback,
            confidence: r.confidence,
          },
        });
      })
    );

    const { score, totalPoints } = await recomputeScore(attempt.id);
    const gradingStatus = usedHeuristic ? 'degraded' : 'complete';
    await prisma.examSession.update({
      where: { id: attempt.id },
      data: { gradingStatus, gradedAt: new Date() },
    });

    return { gradingStatus, graded: results.length, score, totalPoints };
  } catch (err: any) {
    console.error('CBT grading failed:', err?.message || err);
    // Reset so a retry (or the cron sweep) can pick it up again.
    await prisma.examSession
      .update({ where: { id: attemptId }, data: { gradingStatus: 'failed' } })
      .catch(() => undefined);
    return {
      gradingStatus: 'failed',
      graded: 0,
      score: attempt.score ?? 0,
      totalPoints: attempt.totalPoints ?? 0,
    };
  }
}
