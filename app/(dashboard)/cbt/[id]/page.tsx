import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { ExamRunner } from '@/components/cbt/exam-runner';

export default async function ExamPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect('/login');
  const { id } = await params;
  return <ExamRunner sessionId={id} />;
}