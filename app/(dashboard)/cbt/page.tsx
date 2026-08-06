import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StartExamButton } from '@/components/cbt/start-exam-button';
import { PdfExamCreator } from '@/components/cbt/pdf-exam-creator';

export default async function CbtIndexPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const [courses, sessions, materials] = await Promise.all([
    prisma.course.findMany({ include: { _count: { select: { questions: true } }, lecturer: { select: { fullName: true } } }, orderBy: { createdAt: 'desc' } }),
    prisma.examSession.findMany({ where: { userId: session.userId }, include: { course: { select: { code: true, title: true } } }, orderBy: { startedAt: 'desc' }, take: 10 }),
    prisma.material.findMany({
      where: { userId: session.userId },
      include: { _count: { select: { questions: true } } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ]);

  const docs = materials.map((m) => ({
    id: m.id,
    originalName: m.originalName,
    sizeBytes: m.sizeBytes,
    questionCount: m._count.questions,
    createdAt: m.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold tracking-tight">CBT Engine</h1><p className="text-sm text-lipro-600/70 dark:text-lipro-200/70">Practice with instant feedback or take timed exams — from your courses or your own documents</p></div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card><CardHeader><CardTitle>Timed exam from a document</CardTitle><CardDescription>Upload a PDF, generate MCQ questions and start a countdown exam</CardDescription></CardHeader><CardContent>
          <PdfExamCreator materials={docs} />
        </CardContent></Card>
        <Card><CardHeader><CardTitle>Recent attempts</CardTitle><CardDescription>Your last 10 sessions</CardDescription></CardHeader><CardContent>
          <div className="space-y-2">
            {sessions.length === 0 && <p className="text-sm text-lipro-600/60">No attempts yet.</p>}
            {sessions.map((s) => (
              <div key={s.id} className="rounded-xl p-3 glass-hover flex items-center justify-between">
                <div><div className="text-sm font-medium">{s.course?.code ?? 'Document exam'}</div><div className="text-xs text-lipro-600/60">{new Date(s.startedAt).toLocaleString()}</div></div>
                <Badge tone={s.status === 'completed' ? 'green' : 'amber'}>{s.status === 'completed' && s.score !== null && s.totalPoints ? `${Math.round((s.score/s.totalPoints)*100)}%` : 'In progress'}</Badge>
              </div>
            ))}
          </div>
        </CardContent></Card>
      </div>
      <Card><CardHeader><CardTitle>Start a session from a course</CardTitle><CardDescription>Pick a course, choose practice or exam mode, and set the number of questions</CardDescription></CardHeader><CardContent>
        <div className="space-y-2">
          {courses.map((c) => (
            <div key={c.id} className="rounded-xl p-3 glass-hover">
              <div className="flex items-center justify-between gap-3">
                <div><div className="text-sm font-medium">{c.code} · {c.title}</div><div className="text-xs text-lipro-600/60">{c._count.questions} questions · By {c.lecturer.fullName}</div></div>
                <StartExamButton courseId={c.id} />
              </div>
            </div>
          ))}
          {courses.length === 0 && <p className="text-sm text-lipro-600/60">No courses with questions yet.</p>}
        </div>
      </CardContent></Card>
    </div>
  );
}
