import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/api-guard';
import { canAccess } from '@/lib/auth';

/**
 * Previously returned every field, including `answer` and `explanation`, to any
 * authenticated user — a student could fetch this before starting an exam on
 * the course. Full detail is now restricted to the course's lecturer or an admin.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ok, user, response } = await guard();
  if (!ok || !user) return response!;
  const { id } = await params;

  const course = await prisma.course.findUnique({ where: { id }, select: { lecturerId: true } });
  if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 });

  const canSeeAnswers = course.lecturerId === user.userId || canAccess('ADMIN', user.role);

  const rows = await prisma.question.findMany({
    where: { courseId: id },
    orderBy: { createdAt: 'desc' },
  });

  const questions = canSeeAnswers ? rows : rows.map(({ answer, explanation, ...rest }) => rest);
  return NextResponse.json({ questions });
}
