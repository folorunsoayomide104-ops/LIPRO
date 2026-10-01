import type { ComponentType } from 'react';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import {
  ArrowRight,
  GraduationCap,
  FileText,
  MessageSquare,
  Brain,
  Bell,
  Target,
  Calendar,
  TrendingUp,
  Trophy,
  BookOpen,
  ClipboardList,
  Sparkles,
  Flame,
} from 'lucide-react';
import WeakTopics from '@/components/dashboard/weak-topics';
import InsightCarousel from '@/components/dashboard/insight-carousel';
import OverviewChart from '@/components/dashboard/overview-chart';
import GoalGauge from '@/components/dashboard/goal-gauge';
import ActivityList from '@/components/dashboard/activity-list';
import CourseBreakdown from '@/components/dashboard/course-breakdown';
import { getWeakTopics } from '@/lib/weak-topics';
import { getStudyStreak } from '@/lib/cbt/streak';
import { cn } from '@/lib/utils';

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: ComponentType<{ className?: string }>;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl bg-studio-surface p-4 shadow-studio-border sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-studio-subtle">{label}</p>
          <p className="tnum mt-1.5 font-studio-display text-2xl tracking-tight text-studio-fg sm:text-[1.75rem]">{value}</p>
          {hint && <p className="mt-1 text-xs text-studio-muted">{hint}</p>}
        </div>
        <span
          className={cn(
            'grid h-9 w-9 shrink-0 place-items-center rounded-xl text-studio-primary shadow-studio-border',
            accent || 'bg-studio-elevated',
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>
    </div>
  );
}

export default async function StudentDashboard() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role !== 'STUDENT') redirect(`/dashboard`);

  const [courses, recentAttempts, allScoredAttempts, notes, me, courseCount, attemptCount, noteCount, notices, weakTopics, studyStreak] =
    await Promise.all([
      prisma.course.findMany({
        where: {
          faculty: { not: undefined },
          OR: [{ level: '100' }, { level: '200' }, { level: '300' }, { level: '400' }, { level: '500' }],
        },
        include: {
          _count: { select: { notes: true, questions: true } },
          lecturer: { select: { fullName: true, avatarUrl: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 6,
      }),
      prisma.examSession.findMany({
        where: { userId: session.userId },
        include: { course: { select: { title: true, code: true } } },
        orderBy: { startedAt: 'desc' },
        take: 20,
      }),
      prisma.examSession.findMany({
        where: { userId: session.userId, score: { not: null }, totalPoints: { not: null } },
        select: { score: true, totalPoints: true },
      }),
      prisma.note.findMany({
        where: { userId: session.userId },
        include: { course: { select: { code: true, title: true } } },
        orderBy: { updatedAt: 'desc' },
        take: 6,
      }),
      prisma.user.findUnique({
        where: { id: session.userId },
        select: {
          walletBalance: true,
          subscriptionTier: true,
          fullName: true,
          matricNumber: true,
          university: true,
          faculty: true,
          department: true,
          level: true,
          avatarUrl: true,
        },
      }),
      prisma.course.count(),
      prisma.examSession.count({ where: { userId: session.userId } }),
      prisma.note.count({ where: { userId: session.userId } }),
      prisma.notification.findMany({
        where: { userId: session.userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      getWeakTopics(session.userId),
      getStudyStreak(session.userId),
    ]);

  const scoredPcts = allScoredAttempts
    .filter((a) => a.totalPoints)
    .map((a) => Math.round((a.score! / a.totalPoints!) * 100));
  const avgScore = scoredPcts.length
    ? Math.round(scoredPcts.reduce((s, p) => s + p, 0) / scoredPcts.length)
    : null;
  const bestPct = scoredPcts.length ? Math.max(...scoredPcts) : null;

  const trend = [...recentAttempts]
    .reverse()
    .filter((a) => a.score !== null && a.totalPoints)
    .map((a) => ({
      label: new Date(a.startedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      pct: Math.round((a.score! / a.totalPoints!) * 100),
      sub: a.course?.code || undefined,
    }));

  const attemptItems = recentAttempts.slice(0, 6).map((a) => ({
    id: a.id,
    code: a.course?.code ?? 'Document exam',
    date: `${new Date(a.startedAt).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
    })}, ${new Date(a.startedAt).toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    })}`,
    pct: a.score !== null && a.totalPoints ? Math.round((a.score / a.totalPoints) * 100) : null,
    done: a.status === 'completed',
  }));

  const latestPct = trend.length ? trend[trend.length - 1].pct : null;
  const deltaLatest =
    trend.length >= 2 ? trend[trend.length - 1].pct - trend[trend.length - 2].pct : null;

  const courseTally = new Map<string, number>();
  notes.forEach((n) => {
    if (n.course?.code) courseTally.set(n.course.code, (courseTally.get(n.course.code) || 0) + 1);
  });
  recentAttempts.forEach((a) => {
    if (a.course?.code) courseTally.set(a.course.code, (courseTally.get(a.course.code) || 0) + 1);
  });
  const courseActivity = [...courseTally.entries()]
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count);
  const totalActivity = courseActivity.reduce((s, c) => s + c.count, 0);
  const topCourseActivity = courseActivity.slice(0, 4);
  const courseOverflow = Math.max(0, courseActivity.length - 4);

  const insights: string[] = [];
  if (deltaLatest !== null) {
    insights.push(
      `Your last CBT score ${deltaLatest >= 0 ? 'improved' : 'dropped'} by ${Math.abs(deltaLatest)}% versus your previous attempt.`,
    );
  } else if (avgScore !== null) {
    insights.push(
      `Your average CBT score is ${avgScore}% across ${attemptCount} attempt${attemptCount === 1 ? '' : 's'}.`,
    );
  }
  if (studyStreak > 0) {
    insights.push(`You're on a ${studyStreak}-day study streak — keep showing up.`);
  }
  insights.push(
    weakTopics.length
      ? `You have ${weakTopics.length} weak topic${weakTopics.length === 1 ? '' : 's'} — drill them from CBT or LIPRO AI.`
      : 'No weak topics detected yet — keep practicing to build your profile.',
  );
  insights.push(`You've saved ${noteCount} note${noteCount === 1 ? '' : 's'} for revision so far.`);
  insights.push(
    `You've completed ${attemptCount} CBT attempt${attemptCount === 1 ? '' : 's'} — consistency beats cramming.`,
  );

  const firstName = me?.fullName?.split(' ')[0] || 'student';
  const monthLabel = new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const unreadNotices = notices.filter((n) => !n.isRead).length;

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-8">
      <header className="studio-rise flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-studio-subtle">
            Student workspace
          </p>
          <h1 className="mt-1 font-studio-display text-2xl tracking-tight text-studio-fg sm:text-3xl">
            Good to see you, {firstName}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-studio-muted">
            <span className="truncate">
              {me?.university || 'LIPRO'}
              {me?.department ? ` · ${me.department}` : ''}
              {me?.level ? ` · Level ${me.level}` : ''}
            </span>
            <Badge tone="indigo">{me?.subscriptionTier || 'FREE'} plan</Badge>
            {me?.matricNumber && (
              <span className="hidden rounded-full bg-studio-elevated px-2.5 py-0.5 text-xs text-studio-subtle shadow-studio-border sm:inline">
                {me.matricNumber}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full bg-studio-elevated px-3 py-2 text-xs font-medium text-studio-muted shadow-studio-border">
            <Calendar className="h-3.5 w-3.5" />
            {monthLabel}
          </span>
          <Link
            href="/lipro-ai"
            className="inline-flex h-10 items-center gap-1.5 rounded-full bg-studio-elevated px-4 text-sm font-medium text-studio-muted shadow-studio-border transition-colors hover:text-studio-fg"
          >
            <MessageSquare className="h-4 w-4" />
            LIPRO AI
          </Link>
          <Link
            href="/cbt"
            className="inline-flex h-10 items-center gap-1.5 rounded-full bg-studio-primary px-4 text-sm font-semibold text-studio-primary-fg shadow-md transition-transform hover:scale-[1.02] active:scale-95"
          >
            <Brain className="h-4 w-4" />
            Start CBT
          </Link>
        </div>
      </header>

      <section className="studio-rise studio-rise-delay-1 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard
          label="Average score"
          value={avgScore !== null ? `${avgScore}%` : '—'}
          hint={scoredPcts.length ? `Across ${scoredPcts.length} graded` : 'No scores yet'}
          icon={TrendingUp}
        />
        <StatCard
          label="Best score"
          value={bestPct !== null ? `${bestPct}%` : '—'}
          hint="Personal best"
          icon={Trophy}
        />
        <StatCard
          label="CBT attempts"
          value={String(attemptCount)}
          hint={latestPct !== null ? `Latest ${latestPct}%` : 'Start your first'}
          icon={ClipboardList}
        />
        <StatCard
          label="Study streak"
          value={studyStreak > 0 ? `${studyStreak}d` : '—'}
          hint={studyStreak > 0 ? 'Consecutive days with a completed CBT' : 'Complete a CBT today to start'}
          icon={Flame}
        />
        <StatCard
          label="Revision notes"
          value={String(noteCount)}
          hint={`${courseCount} courses available`}
          icon={BookOpen}
        />
      </section>

      <section className="studio-rise studio-rise-delay-2 grid gap-4 lg:grid-cols-5">
        <div className="rounded-2xl bg-studio-surface p-5 shadow-studio-border sm:p-6 lg:col-span-3">
          <OverviewChart
            latestPct={latestPct}
            deltaLatest={deltaLatest}
            attemptCount={attemptCount}
            courseCount={courseCount}
            trend={trend}
            avgScore={avgScore}
          />
        </div>
        <div className="rounded-2xl bg-studio-surface p-5 shadow-studio-border sm:p-6 lg:col-span-2">
          <GoalGauge avgScore={avgScore} bestScore={bestPct} />
        </div>
      </section>

      <section className="studio-rise studio-rise-delay-2 overflow-hidden rounded-2xl bg-studio-surface shadow-studio-border">
        <div className="min-h-[200px] p-5 sm:p-6">
          <InsightCarousel insights={insights} />
        </div>
      </section>

      <section className="studio-rise studio-rise-delay-3 grid gap-4 lg:grid-cols-5">
        <div className="rounded-2xl bg-studio-surface p-5 shadow-studio-border sm:p-6 lg:col-span-3">
          <ActivityList attempts={attemptItems} />
        </div>
        <div className="rounded-2xl bg-studio-surface p-5 shadow-studio-border sm:p-6 lg:col-span-2">
          <CourseBreakdown
            totalActivity={totalActivity}
            courses={topCourseActivity}
            overflow={courseOverflow}
          />
        </div>
      </section>

      <section className="studio-rise rounded-2xl bg-studio-surface p-5 shadow-studio-border sm:p-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-studio-subtle">
              Focus areas
            </p>
            <h2 className="mt-1 flex items-center gap-2 font-studio-display text-xl tracking-tight text-studio-fg">
              <Target className="h-4 w-4 text-studio-primary" />
              Weak topics
            </h2>
            <p className="mt-1 text-sm text-studio-muted">
              Lowest CBT accuracy — prioritise these for revision
            </p>
          </div>
          <Link
            href="/cbt"
            className="inline-flex items-center gap-1 text-xs font-semibold text-studio-primary hover:underline"
          >
            Open CBT <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <WeakTopics topics={weakTopics} />
      </section>

      <section className="studio-rise grid gap-4 lg:grid-cols-5">
        <div className="rounded-2xl bg-studio-surface p-5 shadow-studio-border sm:p-6 lg:col-span-3">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-studio-subtle">
                Catalogue
              </p>
              <h2 className="mt-1 font-studio-display text-xl tracking-tight text-studio-fg">
                Recommended courses
              </h2>
              <p className="mt-1 text-sm text-studio-muted">Matched to your faculty and level</p>
            </div>
            <Link
              href="/courses"
              className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-studio-primary hover:underline"
            >
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {courses.length === 0 ? (
            <p className="rounded-xl border border-dashed border-studio-border-strong px-4 py-8 text-center text-sm text-studio-subtle">
              No courses available yet — ask your lecturer to publish materials.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {courses.map((c) => (
                <Link
                  key={c.id}
                  href={`/courses/${c.id}`}
                  className="group rounded-xl bg-studio-elevated p-4 shadow-studio-border transition-colors hover:bg-studio-elevated/70"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-studio-primary text-studio-primary-fg">
                      <GraduationCap className="h-5 w-5" />
                    </span>
                    {c.lecturer.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={c.lecturer.avatarUrl}
                        alt={c.lecturer.fullName}
                        className="h-7 w-7 rounded-full object-cover ring-2 ring-studio-surface"
                      />
                    ) : (
                      <span className="grid h-7 w-7 place-items-center rounded-full bg-studio-surface text-[10px] font-bold text-studio-muted ring-2 ring-studio-surface">
                        {c.lecturer.fullName
                          .split(' ')
                          .map((p) => p[0])
                          .slice(0, 2)
                          .join('')
                          .toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-studio-primary">
                    {c.code}
                  </div>
                  <div className="mt-0.5 line-clamp-2 text-sm font-semibold leading-snug text-studio-fg">
                    {c.title}
                  </div>
                  <div className="mt-0.5 text-xs text-studio-subtle">By {c.lecturer.fullName}</div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-1.5">
                      <Badge tone="purple">{c._count.notes} notes</Badge>
                      <Badge tone="indigo">{c._count.questions} Qs</Badge>
                    </div>
                    <span className="shrink-0 rounded-full bg-studio-primary px-3 py-1 text-xs font-semibold text-studio-primary-fg transition-transform group-hover:scale-105">
                      Open
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-studio-surface p-5 shadow-studio-border sm:p-6 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-studio-subtle">
                Updates
              </p>
              <h2 className="mt-1 flex items-center gap-2 font-studio-display text-xl tracking-tight text-studio-fg">
                <Bell className="h-4 w-4 text-studio-primary" />
                Notices
                {unreadNotices > 0 && (
                  <span className="rounded-full bg-studio-primary px-2 py-0.5 text-[10px] font-bold text-studio-primary-fg">
                    {unreadNotices}
                  </span>
                )}
              </h2>
            </div>
            <Link
              href="/notifications"
              className="inline-flex items-center gap-1 text-xs font-semibold text-studio-primary hover:underline"
            >
              See all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {notices.length === 0 ? (
            <p className="rounded-xl border border-dashed border-studio-border-strong px-4 py-8 text-center text-sm text-studio-subtle">
              You're all caught up — no notices yet.
            </p>
          ) : (
            <div className="space-y-2">
              {notices.map((n) => (
                <Link
                  key={n.id}
                  href="/notifications"
                  className="block rounded-xl bg-studio-elevated px-3.5 py-3 shadow-studio-border transition-colors hover:bg-studio-elevated/70"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-studio-fg">{n.title}</p>
                    {!n.isRead && (
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-studio-primary" aria-hidden />
                    )}
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-studio-subtle">{n.message}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="studio-rise rounded-2xl bg-studio-surface p-5 shadow-studio-border sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-studio-subtle">
              Revision
            </p>
            <h2 className="mt-1 font-studio-display text-xl tracking-tight text-studio-fg">
              Recent notes
            </h2>
            <p className="mt-1 text-sm text-studio-muted">Notes you've created or updated</p>
          </div>
          <Link
            href="/notes"
            className="inline-flex items-center gap-1 text-xs font-semibold text-studio-primary hover:underline"
          >
            Open notes <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {notes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-studio-border-strong px-4 py-10 text-center">
            <FileText className="mx-auto h-6 w-6 text-studio-subtle" />
            <p className="mt-2 text-sm font-medium text-studio-muted">No notes yet</p>
            <p className="mt-1 text-xs text-studio-subtle">
              Create your first note to start structured revision.
            </p>
            <Link
              href="/notes"
              className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-full bg-studio-primary px-4 text-xs font-semibold text-studio-primary-fg"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Create a note
            </Link>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {notes.map((n) => (
              <Link
                key={n.id}
                href={`/notes?id=${n.id}`}
                className="group flex items-start gap-3 rounded-xl bg-studio-elevated p-3.5 shadow-studio-border transition-colors hover:bg-studio-elevated/70"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-studio-surface text-studio-primary shadow-studio-border">
                  <FileText className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-studio-fg group-hover:text-studio-primary">
                    {n.title}
                  </div>
                  <div className="mt-0.5 text-xs text-studio-subtle">
                    {n.course?.code || 'General'} · Updated{' '}
                    {new Date(n.updatedAt).toLocaleDateString(undefined, {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
