import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Sparkles, ArrowRight, GraduationCap, FileText, MessageSquare, Brain, TrendingUp, PieChart } from 'lucide-react';
import StatTiles from '@/components/dashboard/stat-tiles';
import ScoreTrend from '@/components/dashboard/score-trend';
import TypeDonut from '@/components/dashboard/type-donut';
import RecentAttempts from '@/components/dashboard/recent-attempts';
import AmbientBackground from '@/components/dashboard/ambient-bg';

const TYPE_ORDER = ['MCQ', 'TRUE_FALSE', 'FILL_BLANK', 'THEORY', 'ESSAY'];

export default async function StudentDashboard() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role !== 'STUDENT') redirect(`/dashboard`);

  const [courses, recentAttempts, notes, me, questionTypes, courseCount, attemptCount, noteCount] = await Promise.all([
    prisma.course.findMany({
      where: { faculty: { not: undefined }, OR: [{ level: '100' }, { level: '200' }, { level: '300' }, { level: '400' }, { level: '500' }] },
      include: { _count: { select: { notes: true, questions: true } }, lecturer: { select: { fullName: true } } },
      orderBy: { createdAt: 'desc' }, take: 6,
    }),
    prisma.examSession.findMany({
      where: { userId: session.userId },
      include: { course: { select: { title: true, code: true } } },
      orderBy: { startedAt: 'desc' }, take: 5,
    }),
    prisma.note.findMany({
      where: { userId: session.userId },
      include: { course: { select: { code: true, title: true } } },
      orderBy: { updatedAt: 'desc' }, take: 5,
    }),
    prisma.user.findUnique({ where: { id: session.userId }, select: { walletBalance: true, subscriptionTier: true, fullName: true, matricNumber: true, university: true, faculty: true, department: true, level: true, avatarUrl: true } }),
    prisma.question.groupBy({ by: ['type'], _count: { _all: true } }),
    prisma.course.count(),
    prisma.examSession.count({ where: { userId: session.userId } }),
    prisma.note.count({ where: { userId: session.userId } }),
  ]);

  const initials = (me?.fullName || 'S').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  const stats = [
    { label: 'Courses', value: courseCount, accent: 'text-lipro-600 dark:text-lipro-300', chip: 'bg-lipro-500/10 text-lipro-600 dark:text-lipro-300 border-lipro-500/20', icon: 'courses' as const, sub: 'Across your level' },
    { label: 'CBT attempts', value: attemptCount, accent: 'text-indigo-600 dark:text-indigo-300', chip: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border-indigo-500/20', icon: 'cbt' as const, sub: 'Practice & exam mode' },
    { label: 'Notes saved', value: noteCount, accent: 'text-emerald-600 dark:text-emerald-300', chip: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/20', icon: 'notes' as const, sub: 'Your study materials' },
    { label: 'Wallet', value: me?.walletBalance ?? 0, format: 'ngn' as const, accent: 'text-amber-600 dark:text-amber-300', chip: 'bg-amber-500/10 text-amber-600 dark:text-amber-300 border-amber-500/20', icon: 'wallet' as const, sub: 'Naira balance' },
  ];

  const avgScore = recentAttempts.filter((a) => a.score !== null && a.totalPoints).length
    ? Math.round(recentAttempts.filter((a) => a.score !== null && a.totalPoints).reduce((s, a) => s + (a.score! / a.totalPoints!) * 100, 0) / recentAttempts.filter((a) => a.score !== null && a.totalPoints).length)
    : null;

  const trend = [...recentAttempts]
    .reverse()
    .filter((a) => a.score !== null && a.totalPoints)
    .slice(0, 8)
    .map((a) => ({
      label: new Date(a.startedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      pct: Math.round((a.score! / a.totalPoints!) * 100),
    }));

  const attemptItems = recentAttempts.map((a) => ({
    id: a.id,
    code: a.course?.code ?? 'Document exam',
    date: new Date(a.startedAt).toLocaleDateString(),
    pct: a.score !== null && a.totalPoints ? Math.round((a.score / a.totalPoints) * 100) : null,
    done: a.status === 'completed',
  }));

  const typeDist = questionTypes
    .map((t) => ({ type: t.type, count: t._count._all }))
    .sort((a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type));

  return (
    <div className="space-y-6">
      {/* Welcome band */}
      <section className="enter relative overflow-hidden rounded-2xl border border-lipro-200/40 bg-gradient-to-br from-lipro-600 via-lipro-500 to-indigo-500 p-6 text-white shadow-xl shadow-lipro-600/20 md:p-8 dark:border-lipro-500/20">
        <AmbientBackground variant="beams" />
        <div className="float-slow pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-3xl" aria-hidden="true" />
        <div className="float-slow pointer-events-none absolute -bottom-24 right-24 h-72 w-72 rounded-full bg-indigo-300/20 blur-3xl" style={{ animationDelay: '-2.5s' }} aria-hidden="true" />
        <div className="float-slow pointer-events-none absolute -left-10 top-8 h-40 w-40 rounded-full bg-white/10 blur-2xl" style={{ animationDelay: '-5s' }} aria-hidden="true" />

        <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] backdrop-blur">
              <Sparkles className="h-3 w-3" /> Student dashboard
            </span>
            <h1 className="heading mt-4 text-2xl font-bold md:text-3xl">Good to see you, {me?.fullName?.split(' ')[0] || 'student'}</h1>
            <p className="mt-1.5 text-sm text-white/80">
              {me?.university || 'LIPRO Academy'} · {me?.faculty || '—'} · {me?.department || '—'} · Level {me?.level || '—'}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Badge className="border-white/25 bg-white/15 text-white">{me?.subscriptionTier || 'FREE'} plan</Badge>
              {me?.matricNumber && <Badge className="border-white/25 bg-white/10 text-white/90 font-mono text-[11px]">{me.matricNumber}</Badge>}
              {avgScore !== null && (
                <Badge className="border-white/25 bg-white/10 text-white/90">Avg score {avgScore}%</Badge>
              )}
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2 md:flex-col md:items-end">
            <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-2xl bg-white/15 text-xl font-bold ring-2 ring-white/30 backdrop-blur">
              {me?.avatarUrl ? <img src={me.avatarUrl} alt="Your avatar" className="h-full w-full object-cover" /> : initials}
            </div>
            <div className="flex gap-2">
              <Link href="/cbt" className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-lipro-700 shadow-lg transition-transform hover:scale-[1.03] active:scale-95">
                <Brain className="h-4 w-4" /> Start CBT
              </Link>
              <Link href="/lipro-ai" className="inline-flex items-center gap-1.5 rounded-xl border border-white/30 bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur transition-colors hover:bg-white/20">
                <MessageSquare className="h-4 w-4" /> LIPRO AI
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stat tiles */}
      <StatTiles stats={stats} />

      {/* Performance analytics */}
      <section className="enter" style={{ animationDelay: '70ms' }}>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="glass relative overflow-hidden rounded-2xl p-6 lg:col-span-2">
            <AmbientBackground variant="aurora" />
            <div className="relative">
              <div className="mb-4 flex items-center justify-between gap-2">
                <div>
                  <h2 className="heading flex items-center gap-2 text-lg font-bold">
                    <TrendingUp className="h-4 w-4 text-lipro-500" /> Performance trend
                  </h2>
                  <p className="text-sm text-lipro-600/60 dark:text-lipro-200/50">Your latest CBT scores</p>
                </div>
                {avgScore !== null && (
                  <span className="tnum rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-300">
                    Avg {avgScore}%
                  </span>
                )}
              </div>
              <ScoreTrend points={trend} />
            </div>
          </div>

          <div className="glass relative overflow-hidden rounded-2xl p-6">
            <AmbientBackground variant="dots" />
            <div className="relative">
              <div className="mb-4">
                <h2 className="heading flex items-center gap-2 text-lg font-bold">
                  <PieChart className="h-4 w-4 text-lipro-500" /> Question mix
                </h2>
                <p className="text-sm text-lipro-600/60 dark:text-lipro-200/50">Question types in your library</p>
              </div>
              <TypeDonut slices={typeDist} />
            </div>
          </div>
        </div>
      </section>

      {/* Main grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="enter glass relative overflow-hidden rounded-2xl p-6 lg:col-span-2" style={{ animationDelay: '100ms' }}>
          <AmbientBackground variant="mesh" />
          <div className="relative">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="heading text-lg font-bold">Recommended courses</h2>
                <p className="text-sm text-lipro-600/60 dark:text-lipro-200/50">Tailored to your faculty and level</p>
              </div>
              <Link href="/courses" className="inline-flex items-center gap-1 text-xs font-semibold text-lipro-600 hover:underline dark:text-lipro-300">View all <ArrowRight className="h-3 w-3" /></Link>
            </div>
          <div className="space-y-2">
            {courses.length === 0 && <p className="text-sm text-lipro-600/60">No courses available yet — ask your lecturer to publish materials.</p>}
            {courses.map((c) => (
              <Link key={c.id} href={`/courses/${c.id}`} className="group flex items-center justify-between gap-3 rounded-xl p-3.5 transition-all glass-hover">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-lipro-200/60 bg-lipro-50/60 text-lipro-600 dark:border-lipro-500/20 dark:bg-lipro-950/40 dark:text-lipro-300">
                    <GraduationCap className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{c.code} · {c.title}</div>
                    <div className="text-xs text-lipro-600/60">By {c.lecturer.fullName}</div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge tone="purple">{c._count.notes} notes</Badge>
                  <Badge tone="indigo">{c._count.questions} questions</Badge>
                  <ArrowRight className="h-4 w-4 text-lipro-400 transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
            ))}
          </div>
          </div>
        </section>

        <section className="enter glass relative overflow-hidden rounded-2xl p-6" style={{ animationDelay: '120ms' }}>
          <AmbientBackground variant="drift" />
          <div className="relative">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="heading text-lg font-bold">Recent attempts</h2>
                <p className="text-sm text-lipro-600/60 dark:text-lipro-200/50">Your latest scores</p>
              </div>
              <Link href="/cbt" className="inline-flex items-center gap-1 text-xs font-semibold text-lipro-600 hover:underline dark:text-lipro-300">All <ArrowRight className="h-3 w-3" /></Link>
            </div>
            <RecentAttempts attempts={attemptItems} />
          </div>
        </section>
      </div>

      {/* Recent notes */}
      <section className="enter glass relative overflow-hidden rounded-2xl p-6" style={{ animationDelay: '140ms' }}>
        <AmbientBackground variant="breathe" />
        <div className="relative">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="heading text-lg font-bold">Your recent notes</h2>
              <p className="text-sm text-lipro-600/60 dark:text-lipro-200/50">Notes you&apos;ve created or saved</p>
            </div>
            <Link href="/notes" className="inline-flex items-center gap-1 text-xs font-semibold text-lipro-600 hover:underline dark:text-lipro-300">Open notes <ArrowRight className="h-3 w-3" /></Link>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {notes.length === 0 && (
              <div className="md:col-span-2 rounded-xl border border-dashed border-lipro-200/60 p-5 text-center text-sm text-lipro-600/60">
                No notes yet — create your first note to start revising.
              </div>
            )}
            {notes.map((n) => (
              <Link key={n.id} href={`/notes?id=${n.id}`} className="group flex items-start gap-3 rounded-xl p-3.5 transition-all glass-hover">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-lipro-200/60 bg-lipro-50/60 text-lipro-600 dark:border-lipro-500/20 dark:bg-lipro-950/40 dark:text-lipro-300">
                  <FileText className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold group-hover:text-lipro-700 dark:group-hover:text-lipro-200">{n.title}</div>
                  <div className="mt-0.5 text-xs text-lipro-600/60">{n.course?.code || 'General'} · Updated {new Date(n.updatedAt).toLocaleDateString()}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
