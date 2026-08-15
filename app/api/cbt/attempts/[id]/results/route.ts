import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/api-guard';
import { canAccess } from '@/lib/auth';
import { percentage, toReviewItem, type ReviewItem } from '@/lib/cbt/serialize';

export const dynamic = 'force-dynamic';

function safeParseArray(json: string | null): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function safeParseRecord(json: string | null): Record<string, string> {
  if (!json) return {};
  try {
    const parsed = JSON.parse(json);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Rebuild a breakdown for a pre-rebuild attempt, which stored the paper as
 * JSON-in-string columns rather than ExamAnswer rows. Questions deleted since
 * are rendered as placeholders instead of throwing.
 */
async function legacyReview(attempt: {
  questionIds: string | null;
  answers: string | null;
}): Promise<ReviewItem[]> {
  const ids = safeParseArray(attempt.questionIds);
  if (ids.length === 0) return [];
  const responses = safeParseRecord(attempt.answers);

  const questions = await prisma.question.findMany({ where: { id: { in: ids } } });
  const byId = new Map(questions.map((q) => [q.id, q]));

  return ids.map((qid, index) => {
    const q = byId.get(qid);
    const response = responses[qid] ?? null;
    if (!q) {
      return {
        itemId: qid,
        orderIndex: index,
        type: 'UNKNOWN',
        prompt: 'This question is no longer available.',
        options: null,
        imageUrl: null,
        points: 0,
        response,
        revealed: true,
        correctAnswer: '',
        explanation: null,
        feedback: null,
        isCorrect: null,
        awarded: 0,
        isGraded: false,
        gradeMethod: null,
        confidence: null,
        overridden: false,
        overrideNote: null,
      } satisfies ReviewItem;
    }

    const isCorrect =
      (response ?? '').trim().toLowerCase() === (q.answer ?? '').trim().toLowerCase() &&
      (response ?? '').trim().length > 0;

    let options: string[] | null = null;
    try {
      const parsed = q.options ? JSON.parse(q.options) : null;
      options = Array.isArray(parsed) ? parsed.map(String) : null;
    } catch {
      options = null;
    }

    return {
      itemId: q.id,
      orderIndex: index,
      type: q.type,
      prompt: q.question,
      options,
      imageUrl: q.imageUrl,
      points: q.points,
      response,
      revealed: true,
      correctAnswer: q.answer,
      explanation: q.explanation,
      feedback: null,
      isCorrect,
      awarded: isCorrect ? q.points : 0,
      isGraded: true,
      gradeMethod: 'exact',
      confidence: null,
      overridden: false,
      overrideNote: null,
    } satisfies ReviewItem;
  });
}

/** Permanent, linkable review. The only place a student ever sees answers. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ok, user, response } = await guard();
  if (!ok || !user) return response!;
  const { id } = await params;

  const attempt = await prisma.examSession.findUnique({
    where: { id },
    include: {
      items: { orderBy: { orderIndex: 'asc' } },
      course: { select: { id: true, title: true, lecturerId: true } },
      user: { select: { id: true, fullName: true } },
    },
  });
  if (!attempt) return NextResponse.json({ error: 'Attempt not found' }, { status: 404 });

  const isOwner = attempt.userId === user.userId;
  const isLecturer = !!attempt.course && attempt.course.lecturerId === user.userId;
  const isAdmin = canAccess('ADMIN', user.role);
  if (!isOwner && !isLecturer && !isAdmin) {
    return NextResponse.json({ error: 'Attempt not found' }, { status: 404 });
  }

  // Answers must not leak out of an exam that is still running.
  if (attempt.status === 'in_progress') {
    return NextResponse.json(
      { error: 'This attempt is not finished yet', status: attempt.status },
      { status: 409 }
    );
  }

  const legacy = attempt.schemaVersion === 1 || attempt.items.length === 0;
  const items = legacy ? await legacyReview(attempt) : attempt.items.map(toReviewItem);

  return NextResponse.json({
    attempt: {
      id: attempt.id,
      mode: attempt.mode,
      status: attempt.status,
      sourceTitle: attempt.sourceTitle ?? attempt.course?.title ?? 'Exam',
      score: attempt.score ?? 0,
      totalPoints: attempt.totalPoints ?? 0,
      percentage: percentage(attempt.score, attempt.totalPoints),
      startedAt: attempt.startedAt.toISOString(),
      completedAt: attempt.completedAt?.toISOString() ?? null,
      autoSubmitted: attempt.autoSubmitted,
      gradingStatus: attempt.gradingStatus,
      aiFeedback: attempt.aiFeedback,
      legacy,
      canOverride: isLecturer || isAdmin,
      student: isOwner ? null : { id: attempt.user.id, name: attempt.user.fullName },
    },
    items,
  });
}
