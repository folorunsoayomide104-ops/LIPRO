import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
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

  // One grouped query for every course's per-format counts, rather than a
  // query per course row — same pattern used on the admin students page.
  const typeGroups = courses.length
    ? await prisma.question.groupBy({ by: ['courseId', 'type'], where: { courseId: { in: courses.map((c) => c.id) } }, _count: true })
    : [];
  const typeCountsByCourse = new Map<string, Record<string, number>>();
  for (const g of typeGroups) {
    if (!g.courseId) continue;
    const bucket = typeCountsByCourse.get(g.courseId) || {};
    bucket[g.type] = g._count;
    typeCountsByCourse.set(g.courseId, bucket);
  }

  return (
    <div className="-mx-4 -mt-2 min-h-[calc(100dvh-4rem)] bg-studio-bg p-4 text-studio-fg md:p-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <header className="studio-rise">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-studio-subtle">Exam</p>
          <h1 className="mt-2 font-studio-display text-3xl tracking-tight md:text-4xl">CBT Engine</h1>
          <p className="mt-2 max-w-lg text-sm leading-normal text-studio-muted">
            Practice with instant feedback or take timed exams — from your courses or your own documents.
          </p>
        </header>

        {inProgress.length > 0 && (
          <section className="rounded-xl bg-studio-surface p-5 shadow-studio-border studio-rise studio-rise-delay-1">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-studio-subtle">Resume in progress</p>
            <p className="mt-1 text-sm text-studio-muted">Pick up where you left off — your answers and timer are saved.</p>
            <div className="mt-4 flex flex-col gap-2">
              {inProgress.map((s) => {
                const remaining = s.deadlineAt ? Math.max(0, Math.round((s.deadlineAt.getTime() - Date.now()) / 1000)) : null;
                return (
                  <Link key={s.id} href={`/cbt/${s.id}`} className="flex items-center justify-between gap-3 rounded-lg bg-studio-elevated px-4 py-3 transition-colors hover:bg-studio-elevated/70">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-studio-fg">{s.sourceTitle ?? s.course?.title ?? 'Exam'}</div>
                      <div className="truncate text-xs text-studio-subtle">{s.mode === 'practice' ? 'Practice' : 'Exam'} · Started {new Date(s.startedAt).toLocaleString()}</div>
                    </div>
                    <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${remaining !== null && remaining < 120 ? 'bg-studio-danger/15 text-studio-danger' : 'bg-amber-500/15 text-amber-400'}`}>
                      {remaining !== null ? `${Math.floor(remaining / 60)}m left` : 'Resume'}
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-xl bg-studio-surface p-5 shadow-studio-border studio-rise studio-rise-delay-2">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-studio-subtle">From a document</p>
            <h2 className="mt-1 font-studio-display text-xl tracking-tight text-studio-fg">Practice or exam from a document</h2>
            <p className="mt-1 text-sm text-studio-muted">Upload a PDF, choose a question format, then practice with instant feedback or start a timed exam.</p>
            <div className="mt-5">
              <PdfExamCreator materials={docs} />
            </div>
          </section>
          <section className="rounded-xl bg-studio-surface p-5 shadow-studio-border studio-rise studio-rise-delay-2">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-studio-subtle">Results</p>
            <h2 className="mt-1 font-studio-display text-xl tracking-tight text-studio-fg">Recent results</h2>
            <p className="mt-1 text-sm text-studio-muted">Your last 10 completed sessions.</p>
            <div className="mt-4 flex flex-col gap-2">
              {completed.length === 0 && <p className="text-sm text-studio-subtle">No completed attempts yet.</p>}
              {completed.map((s) => (
                <Link key={s.id} href={`/cbt/${s.id}/results`} className="flex items-center justify-between gap-3 rounded-lg bg-studio-elevated px-4 py-3 transition-colors hover:bg-studio-elevated/70">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-studio-fg">{s.sourceTitle ?? s.course?.code ?? 'Document exam'}</div>
                    <div className="truncate text-xs text-studio-subtle">{new Date(s.startedAt).toLocaleString()}</div>
                  </div>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${s.status === 'completed' ? 'bg-studio-primary/15 text-studio-primary' : 'bg-studio-elevated text-studio-muted shadow-studio-border'}`}>
                    {s.status === 'completed' && s.score !== null && s.totalPoints ? `${Math.round((s.score / s.totalPoints) * 100)}%` : s.status}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        </div>

        <section className="rounded-xl bg-studio-surface p-5 shadow-studio-border studio-rise studio-rise-delay-3">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-studio-subtle">From a course</p>
          <h2 className="mt-1 font-studio-display text-xl tracking-tight text-studio-fg">Start a session from a course</h2>
          <p className="mt-1 text-sm text-studio-muted">Pick a course, choose practice or exam mode, and set the number of questions.</p>
          <div className="mt-4 flex flex-col gap-2">
            {courses.map((c) => (
              <div key={c.id} className="rounded-lg bg-studio-elevated px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-studio-fg">{c.code} · {c.title}</div>
                    <div className="truncate text-xs text-studio-subtle">{c._count.questions} questions · By {c.lecturer.fullName}</div>
                  </div>
                  <div className="w-full sm:w-auto sm:shrink-0"><StartExamButton courseId={c.id} typeCounts={typeCountsByCourse.get(c.id)} /></div>
                </div>
              </div>
            ))}
            {courses.length === 0 && <p className="text-sm text-studio-subtle">No courses with questions yet.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
