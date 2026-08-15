import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { ExamRunner } from '@/components/cbt/exam-runner';

export default async function ExamPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect('/login');
  const { id } = await params;

  const attempt = await prisma.examSession.findFirst({
    where: { id, userId: session.userId },
    select: { status: true },
  });
  if (!attempt) redirect('/cbt');
  // Avoids a flash of the runner UI for an attempt that's already finished.
  if (attempt.status !== 'in_progress') redirect(`/cbt/${id}/results`);

  return <ExamRunner attemptId={id} />;
}
