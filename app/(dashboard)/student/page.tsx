import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { ArrowRight, GraduationCap, FileText, MessageSquare, Brain, Bell, Target, Calendar } from 'lucide-react';
import AmbientBackground from '@/components/dashboard/ambient-bg';
import WeakTopics from '@/components/dashboard/weak-topics';
import InsightCarousel from '@/components/dashboard/insight-carousel';
import OverviewChart from '@/components/dashboard/overview-chart';
import GoalGauge from '@/components/dashboard/goal-gauge';
import ActivityList from '@/components/dashboard/activity-list';
import CourseBreakdown from '@/components/dashboard/course-breakdown';
import { getWeakTopics } from '@/lib/weak-topics';

export default async function StudentDashboard() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role !== 'STUDENT') redirect(`/dashboard`);

  const [courses, recentAttempts, notes, me, courseCount, attemptCount, noteCount, notices, weakTopics] = await Promise.all([
    prisma.course.findMany({
      where: { faculty: { not: undefined }, OR: [{ level: '100' }, { level: '200' }, { level: '300' }, { level: '400' }, { level: '500' }] },
      include: { _count: { select: { notes: true, questions: true } }, lecturer: { select: { fullName: true, avatarUrl: true } } },
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
    prisma.course.count(),
    prisma.examSession.count({ where: { userId: session.userId } }),
    prisma.note.count({ where: { userId: session.userId } }),
    prisma.notification.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: 'desc' }, take: 4,
    }),
    getWeakTopics(session.userId),
  ]);

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
    date: `${new Date(a.startedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}, ${new Date(a.startedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`,
    pct: a.score !== null && a.totalPoints ? Math.round((a.score / a.totalPoints) * 100) : null,
    done: a.status === 'completed',
  }));

  const latestPct = trend.length ? trend[trend.length - 1].pct : null;
  const deltaLatest = trend.length >= 2 ? trend[trend.length - 1].pct - trend[trend.length - 2].pct : null;
  const scoredAttempts = recentAttempts.filter((a) => a.score !== null && a.totalPoints);
  const bestPct = scoredAttempts.length ? Math.max(...scoredAttempts.map((a) => Math.round((a.score! / a.totalPoints!) * 100))) : null;

  const courseTally = new Map<string, number>();
  notes.forEach((n) => { if (n.course?.code) courseTally.set(n.course.code, (courseTally.get(n.course.code) || 0) + 1); });
  recentAttempts.forEach((a) => { if (a.course?.code) courseTally.set(a.course.code, (courseTally.get(a.course.code) || 0) + 1); });
  const courseActivity = [...courseTally.entries()].map(([code, count]) => ({ code, count })).sort((a, b) => b.count - a.count);
  const totalActivity = courseActivity.reduce((s, c) => s + c.count, 0);
  const topCourseActivity = courseActivity.slice(0, 4);
  const courseOverflow = Math.max(0, courseActivity.length - 4);

  const insights: string[] = [];
  if (deltaLatest !== null) {
    insights.push(`Your last CBT score ${deltaLatest >= 0 ? 'improved' : 'dropped'} by ${Math.abs(deltaLatest)}% versus your previous attempt.`);
  } else if (avgScore !== null) {
    insights.push(`Your average CBT score is ${avgScore}% across ${attemptCount} attempt${attemptCount === 1 ? '' : 's'}.`);
  }
  insights.push(
    weakTopics.length
      ? `You have ${weakTopics.length} weak topic${weakTopics.length === 1 ? '' : 's'} — LIPRO AI can help you drill them.`
      : "No weak topics detected yet — keep practicing to build your profile."
  );
  insights.push(`You've saved ${noteCount} note${noteCount === 1 ? '' : 's'} for revision so far.`);
  insights.push(`You've completed ${attemptCount} CBT attempt${attemptCount === 1 ? '' : 's'} — keep the streak going!`);

  const firstName = me?.fullName?.split(' ')[0] || 'student';

  return (
    <div className="space-y-6">
      {/* Top bar: month context + quick actions, matching the reference's header row */}
      <div className="enter flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="heading truncate text-xl font-bold">Good to see you, {firstName}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-lipro-600/60 dark:text-lipro-200/50">
            <span>{me?.university || 'LIPRO Academy'} · Level {me?.level || '—'}</span>
            <Badge tone="indigo">{me?.subscriptionTier || 'FREE'} plan</Badge>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-xl border border-lipro-200/60 px-3 py-2 text-sm font-medium text-lipro-700 dark:border-lipro-500/20 dark:text-lipro-200">
            <Calendar className="h-4 w-4" /> This Month
          </span>
          <Link href="/lipro-ai" className="inline-flex items-center gap-1.5 rounded-xl border border-lipro-200/60 px-3.5 py-2 text-sm font-semibold text-lipro-700 transition-colors hover:bg-lipro-50 dark:border-lipro-500/20 dark:text-lipro-200 dark:hover:bg-lipro-950/40">
            <MessageSquare className="h-4 w-4" /> LIPRO AI
          </Link>
          <Link href="/cbt" className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold text-white shadow-md transition-transform hover:scale-[1.02] active:scale-95" style={{ background: '#3559F7', boxShadow: '0 6px 16px -4px rgb(53 89 247 / 0.5)' }}>
            <Brain className="h-4 w-4" /> Start CBT
          </Link>
        </div>
      </div>

      {/* Widget grid — AI Insights / Score Overview / Average Score, matching the reference's 3-card row */}
      <section className="enter grid gap-4 lg:grid-cols-7" style={{ animationDelay: '60ms' }}>
        <div className="card relative overflow-hidden lg:col-span-3">
          <InsightCarousel insights={insights} />
        </div>
        <div className="card lg:col-span-2">
          <OverviewChart latestPct={latestPct} deltaLatest={deltaLatest} attemptCount={attemptCount} courseCount={courseCount} trend={trend} />
        </div>
        <div className="card lg:col-span-2">
          <GoalGauge avgScore={avgScore} bestScore={bestPct} />
        </div>
      </section>

      {/* Recent Activity / Study by Course, matching the reference's 2-card row */}
      <section className="enter grid gap-4 lg:grid-cols-3" style={{ animationDelay: '90ms' }}>
        <div className="card lg:col-span-2">
          <ActivityList attempts={attemptItems} />
        </div>
        <div className="card">
          <CourseBreakdown totalActivity={totalActivity} courses={topCourseActivity} overflow={courseOverflow} />
        </div>
      </section>

      {/* Weak topics */}
      <section className="enter glass relative overflow-hidden rounded-2xl p-6" style={{ animationDelay: '90ms' }}>
        <AmbientBackground variant="dots" />
        <div className="relative">
          <div className="mb-4">
            <h2 className="heading flex items-center gap-2 text-lg font-bold">
              <Target className="h-4 w-4 text-lipro-500" /> Weak topics
            </h2>
            <p className="text-sm text-lipro-600/60 dark:text-lipro-200/50">Courses and documents where your CBT accuracy is lowest</p>
          </div>
          <WeakTopics topics={weakTopics} />
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
          {courses.length === 0 && <p className="text-sm text-lipro-600/60">No courses available yet — ask your lecturer to publish materials.</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            {courses.map((c) => (
              <Link key={c.id} href={`/courses/${c.id}`} className="group rounded-xl border border-lipro-200/50 p-4 transition-all glass-hover dark:border-lipro-700/30">
                <div className="mb-3 flex items-center justify-between">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-lipro-500 to-indigo-500 text-white shadow-sm shadow-lipro-500/30">
                    <GraduationCap className="h-5 w-5" />
                  </span>
                  {c.lecturer.avatarUrl ? (
                    <img src={c.lecturer.avatarUrl} alt={c.lecturer.fullName} className="h-7 w-7 rounded-full object-cover ring-2 ring-white dark:ring-surface-dark" />
                  ) : (
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-lipro-100 text-[10px] font-bold text-lipro-600 ring-2 ring-white dark:bg-lipro-950/60 dark:text-lipro-300 dark:ring-surface-dark">
                      {c.lecturer.fullName.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-lipro-500">{c.code}</div>
                <div className="mt-0.5 truncate text-sm font-bold leading-snug">{c.title}</div>
                <div className="mt-0.5 text-xs text-lipro-600/60">By {c.lecturer.fullName}</div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-1.5">
                    <Badge tone="purple">{c._count.notes} notes</Badge>
                    <Badge tone="indigo">{c._count.questions} Qs</Badge>
                  </div>
                  <span className="shrink-0 rounded-full bg-lipro-500 px-3 py-1 text-xs font-semibold text-white transition-transform group-hover:scale-105">View</span>
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
                <h2 className="heading flex items-center gap-2 text-lg font-bold"><Bell className="h-4 w-4 text-lipro-500" /> Notices</h2>
                <p className="text-sm text-lipro-600/60 dark:text-lipro-200/50">Updates and reminders</p>
              </div>
              <Link href="/notifications" className="inline-flex items-center gap-1 text-xs font-semibold text-lipro-600 hover:underline dark:text-lipro-300">See all <ArrowRight className="h-3 w-3" /></Link>
            </div>
            {notices.length === 0 ? (
              <p className="text-sm text-lipro-600/60">No notices yet — you&apos;re all caught up.</p>
            ) : (
              <div className="space-y-3">
                {notices.map((n) => (
                  <div key={n.id} className="rounded-xl p-3.5 glass-hover">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm font-semibold">{n.title}</div>
                      {!n.isRead && <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-lipro-500" aria-hidden="true" />}
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-lipro-600/70 dark:text-lipro-200/60">{n.message}</p>
                    <Link href="/notifications" className="mt-1.5 inline-block text-xs font-semibold text-lipro-600 hover:underline dark:text-lipro-300">See more</Link>
                  </div>
                ))}
              </div>
            )}
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
