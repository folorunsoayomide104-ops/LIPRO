import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/api-guard';

export async function POST(req: Request) {
  const { ok, user, response } = await guard();
  if (!ok || !user) return response!;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  const { sessionId, answers } = body as { sessionId: string; answers: Record<string, string> };
  if (!sessionId || !answers) return NextResponse.json({ error: 'sessionId and answers required' }, { status: 422 });

  const session = await prisma.examSession.findUnique({
    where: { id: sessionId },
    include: { course: true },
  });
  if (!session || session.userId !== user.userId) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  if (session.status === 'completed') return NextResponse.json({ error: 'Session already submitted' }, { status: 422 });

  let questionIds: string[] = [];
  try {
    questionIds = JSON.parse(session.questionIds || '[]');
  } catch {}
  const gradedQuestions =
    questionIds.length > 0
      ? await prisma.question.findMany({ where: { id: { in: questionIds } } })
      : session.courseId
        ? await prisma.question.findMany({ where: { courseId: session.courseId } })
        : [];

  let score = 0;
  let earned = 0;
  const breakdown: any[] = [];
  for (const q of gradedQuestions) {
    const ans = (answers[q.id] || '').trim().toLowerCase();
    const correct = (q.answer || '').trim().toLowerCase();
    const isCorrect = ans.length > 0 && ans === correct;
    score += q.points;
    if (isCorrect) earned += q.points;
    breakdown.push({
      questionId: q.id,
      question: q.question,
      type: q.type,
      options: q.options,
      yourAnswer: answers[q.id] || '',
      correctAnswer: q.answer,
      isCorrect,
      explanation: q.explanation,
      points: q.points,
    });
  }

  const percentage = score > 0 ? Math.round((earned / score) * 100) : 0;

  const completed = await prisma.examSession.update({
    where: { id: sessionId },
    data: {
      status: 'completed',
      score: earned,
      completedAt: new Date(),
      answers: JSON.stringify(answers),
    },
  });

  await prisma.notification.create({
    data: {
      userId: user.userId,
      type: 'ACADEMIC',
      title: 'CBT session completed',
      message: `You scored ${earned} / ${score} (${percentage}%) in ${session.course?.title ?? 'your document exam'}.`,
    },
  });

  return NextResponse.json({
    sessionId: completed.id,
    score: earned,
    totalPoints: score,
    percentage,
    breakdown,
  });
}
