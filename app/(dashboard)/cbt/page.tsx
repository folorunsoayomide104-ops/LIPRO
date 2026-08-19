import Link from 'next/link';
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

  const [courses, inProgress, completed, materials] = await Promise.all([
    prisma.course.findMany({ include: { _count: { select: { questions: true } }, lecturer: { select: { fullName: true } } }, orderBy: { createdAt: 'desc' } }),
    prisma.examSession.findMany({
      where: { userId: session.userId, status: 'in_progress' },
      include: { course: { select: { code: true, title: true } } },
      orderBy: { startedAt: 'desc' },
    }),
    prisma.examSession.findMany({
      where: { userId: session.userId, status: { not: 'in_progress' } },
      include: { course: { select: { code: true, title: true } } },
      orderBy: { startedAt: 'desc' },
      take: 10,
    }),
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

      {inProgress.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Resume in progress</CardTitle><CardDescription>Pick up where you left off — your answers and timer are saved</CardDescription></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {inProgress.map((s) => {
                const remaining = s.deadlineAt ? Math.max(0, Math.round((s.deadlineAt.getTime() - Date.now()) / 1000)) : null;
                return (
                  <Link key={s.id} href={`/cbt/${s.id}`} className="flex items-center justify-between gap-3 rounded-xl p-3 glass-hover">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{s.sourceTitle ?? s.course?.title ?? 'Exam'}</div>
                      <div className="truncate text-xs text-lipro-600/60">{s.mode === 'practice' ? 'Practice' : 'Exam'} · Started {new Date(s.startedAt).toLocaleString()}</div>
                    </div>
                    <Badge tone={remaining !== null && remaining < 120 ? 'rose' : 'amber'} className="shrink-0">
                      {remaining !== null ? `${Math.floor(remaining / 60)}m left` : 'Resume'}
                    </Badge>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card><CardHeader><CardTitle>Timed exam from a document</CardTitle><CardDescription>Upload a PDF, generate MCQ questions and start a countdown exam</CardDescription></CardHeader><CardContent>
          <PdfExamCreator materials={docs} />
        </CardContent></Card>
        <Card><CardHeader><CardTitle>Recent results</CardTitle><CardDescription>Your last 10 completed sessions</CardDescription></CardHeader><CardContent>
          <div className="space-y-2">
            {completed.length === 0 && <p className="text-sm text-lipro-600/60">No completed attempts yet.</p>}
            {completed.map((s) => (
              <Link key={s.id} href={`/cbt/${s.id}/results`} className="flex items-center justify-between gap-3 rounded-xl p-3 glass-hover">
                <div className="min-w-0"><div className="truncate text-sm font-medium">{s.sourceTitle ?? s.course?.code ?? 'Document exam'}</div><div className="truncate text-xs text-lipro-600/60">{new Date(s.startedAt).toLocaleString()}</div></div>
                <Badge tone={s.status === 'completed' ? 'green' : 'purple'} className="shrink-0">
                  {s.status === 'completed' && s.score !== null && s.totalPoints ? `${Math.round((s.score / s.totalPoints) * 100)}%` : s.status}
                </Badge>
              </Link>
            ))}
          </div>
        </CardContent></Card>
      </div>
      <Card><CardHeader><CardTitle>Start a session from a course</CardTitle><CardDescription>Pick a course, choose practice or exam mode, and set the number of questions</CardDescription></CardHeader><CardContent>
        <div className="space-y-2">
          {courses.map((c) => (
            <div key={c.id} className="rounded-xl p-3 glass-hover">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0"><div className="truncate text-sm font-medium">{c.code} · {c.title}</div><div className="truncate text-xs text-lipro-600/60">{c._count.questions} questions · By {c.lecturer.fullName}</div></div>
                <div className="shrink-0"><StartExamButton courseId={c.id} /></div>
              </div>
            </div>
          ))}
          {courses.length === 0 && <p className="text-sm text-lipro-600/60">No courses with questions yet.</p>}
        </div>
      </CardContent></Card>
    </div>
  );
}
