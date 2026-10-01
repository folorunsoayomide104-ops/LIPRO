import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import Link from 'next/link';
import { BookOpen, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

/** Optional teaching overview — CBT invite links live on the admin dashboard only. */
export default async function LecturerWorkspacePage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const where =
    session.role === 'ADMIN'
      ? {}
      : { lecturerId: session.userId };

  const courses = await prisma.course.findMany({
    where,
    include: {
      _count: { select: { questions: true, materials: true, examSessions: true } },
      lecturer: { select: { fullName: true } },
    },
    orderBy: { updatedAt: 'desc' },
    take: 50,
  });

  if (session.role !== 'ADMIN' && courses.length === 0) {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-16 text-center">
        <BookOpen className="mx-auto h-8 w-8 text-studio-subtle" />
        <h1 className="font-studio-display text-2xl text-studio-fg">Teaching overview</h1>
        <p className="text-sm text-studio-muted">
          You don't own any courses yet. CBT pack invites are managed from the admin dashboard.
        </p>
        <Link
          href="/courses"
          className="inline-flex h-10 items-center gap-1.5 rounded-full bg-studio-primary px-4 text-sm font-semibold text-studio-primary-fg"
        >
          Go to courses <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  const totalQ = courses.reduce((s, c) => s + c._count.questions, 0);
  const totalAttempts = courses.reduce((s, c) => s + c._count.examSessions, 0);

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-8">
      <header className="studio-rise">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-studio-subtle">Teaching</p>
        <h1 className="mt-1 font-studio-display text-2xl tracking-tight text-studio-fg sm:text-3xl">
          Course overview
        </h1>
        <p className="mt-1 text-sm text-studio-muted">
          Question banks and attempt volume. Shareable CBT invites are on the{' '}
          <Link href="/admin" className="font-semibold text-studio-primary hover:underline">
            admin dashboard
          </Link>
          .
        </p>
      </header>

      <section className="studio-rise grid grid-cols-2 gap-3 lg:grid-cols-3">
        {[
          { label: 'Courses', value: String(courses.length) },
          { label: 'Questions', value: String(totalQ) },
          { label: 'CBT attempts', value: String(totalAttempts) },
        ].map((k) => (
          <div key={k.label} className="rounded-2xl bg-studio-surface p-4 shadow-studio-border">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-studio-subtle">{k.label}</p>
            <p className="tnum mt-1.5 font-studio-display text-2xl text-studio-fg">{k.value}</p>
          </div>
        ))}
      </section>

      <section className="studio-rise space-y-3">
        {courses.map((c) => (
          <div key={c.id} className="rounded-2xl bg-studio-surface p-4 shadow-studio-border sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-studio-primary">{c.code}</p>
                <h2 className="mt-0.5 font-studio-display text-lg text-studio-fg">{c.title}</h2>
                <p className="mt-1 text-xs text-studio-subtle">
                  {c.faculty} · {c.department} · L{c.level}
                  {session.role === 'ADMIN' ? ` · ${c.lecturer.fullName}` : ''}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge tone="purple">{c._count.questions} Qs</Badge>
                <Badge tone="indigo">{c._count.examSessions} attempts</Badge>
              </div>
            </div>
            <div className="mt-4">
              <Link
                href={`/courses/${c.id}`}
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-studio-elevated px-3.5 text-xs font-semibold text-studio-muted shadow-studio-border hover:text-studio-fg"
              >
                Manage course
              </Link>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
