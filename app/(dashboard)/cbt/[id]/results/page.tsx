import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { canAccess } from '@/lib/auth';
import { ExamResults } from '@/components/cbt/exam-results';

export default async function ExamResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect('/login');
  const { id } = await params;

  const attempt = await prisma.examSession.findUnique({
    where: { id },
    select: { userId: true, status: true },
  });
  if (!attempt) redirect('/cbt');

  const isOwner = attempt.userId === session.userId;
  const isAdmin = canAccess('ADMIN', session.role);
  if (!isOwner && !isAdmin) redirect('/cbt');

  if (attempt.status === 'in_progress') redirect(`/cbt/${id}`);

  return <ExamResults attemptId={id} />;
}
