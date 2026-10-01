import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import Link from 'next/link';
import { BookOpen, Users, ClipboardList, Package, ExternalLink, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

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
      _count: { select: { questions: true, materials: true, examSessions: true, notes: true } },
      lecturer: { select: { fullName: true, email: true } },
    },
    orderBy: { updatedAt: 'desc' },
    take: 50,
  });

  if (session.role !== 'ADMIN' && courses.length === 0) {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-16 text-center">
        <BookOpen className="mx-auto h-8 w-8 text-studio-subtle" />
        <h1 className="font-studio-display text-2xl text-studio-fg">Lecturer workspace</h1>
        <p className="text-sm text-studio-muted">
          You don't own any courses yet. Create a course and add questions to unlock this space.
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
  const thin = courses.filter((c) => c._count.questions < 5);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://lipro-game-developer1.vercel.app';

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-8">
      <header className="studio-rise">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-studio-subtle">Teaching</p>
        <h1 className="mt-1 font-studio-display text-2xl tracking-tight text-studio-fg sm:text-3xl">
          Lecturer workspace
        </h1>
        <p className="mt-1 text-sm text-studio-muted">
          Question banks, attempt volume, and shareable pack links for your courses.
        </p>
      </header>

      <section className="studio-rise grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Courses', value: String(courses.length) },
          { label: 'Questions', value: String(totalQ) },
          { label: 'CBT attempts', value: String(totalAttempts) },
          { label: 'Thin banks', value: String(thin.length), hint: '< 5 questions' },
        ].map((k) => (
          <div key={k.label} className="rounded-2xl bg-studio-surface p-4 shadow-studio-border">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-studio-subtle">{k.label}</p>
            <p className="tnum mt-1.5 font-studio-display text-2xl text-studio-fg">{k.value}</p>
            {'hint' in k && k.hint && <p className="mt-1 text-xs text-studio-muted">{k.hint}</p>}
          </div>
        ))}
      </section>

      {thin.length > 0 && (
        <p className="studio-rise rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {thin.length} course{thin.length === 1 ? '' : 's'} need more questions before a full pack works well.
        </p>
      )}

      <section className="studio-rise space-y-3">
        {courses.map((c) => {
          const invite = `${baseUrl}/invite/course/${c.id}`;
          return (
            <div key={c.id} className="rounded-2xl bg-studio-surface p-4 shadow-studio-border sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-studio-primary">{c.code}</p>
                  <h2 className="mt-0.5 font-studio-display text-lg text-studio-fg">{c.title}</h2>
                  <p className="mt-1 text-xs text-studio-subtle">
                    {c.faculty} · {c.department} · L{c.level} · {c.semester}
                    {session.role === 'ADMIN' ? ` · ${c.lecturer.fullName}` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge tone="purple">{c._count.questions} Qs</Badge>
                  <Badge tone="indigo">{c._count.examSessions} attempts</Badge>
                  <Badge tone="amber">{c._count.materials} materials</Badge>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Link href={`/courses/${c.id}`} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-studio-elevated px-3.5 text-xs font-semibold text-studio-muted shadow-studio-border hover:text-studio-fg">
                  Manage course
                </Link>
                <Link href="/cbt" className="inline-flex h-9 items-center gap-1.5 rounded-full bg-studio-primary px-3.5 text-xs font-semibold text-studio-primary-fg">
                  Open CBT
                </Link>
                <a href={invite} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-full bg-studio-elevated px-3.5 text-xs font-semibold text-studio-primary shadow-studio-border">
                  <ExternalLink className="h-3.5 w-3.5" /> Invite link
                </a>
              </div>
              <p className="mt-2 break-all text-[11px] text-studio-subtle">{invite}</p>
            </div>
          );
        })}
      </section>
    </div>
  );
}
