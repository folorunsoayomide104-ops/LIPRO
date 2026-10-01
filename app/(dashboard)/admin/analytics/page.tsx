import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import Link from 'next/link';
import { ArrowLeft, BarChart3, TrendingUp, Users, AlertTriangle } from 'lucide-react';
import { unpackQuestionMeta } from '@/lib/question-meta';

export default async function AdminAnalyticsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role !== 'ADMIN') redirect('/dashboard');

  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  const [sessions, answers, students] = await Promise.all([
    prisma.examSession.findMany({
      where: { startedAt: { gte: fourteenDaysAgo } },
      select: {
        id: true,
        status: true,
        score: true,
        totalPoints: true,
        mode: true,
        startedAt: true,
        courseId: true,
        course: { select: { code: true, title: true } },
      },
      orderBy: { startedAt: 'asc' },
      take: 2000,
    }),
    prisma.examAnswer.findMany({
      where: {
        isGraded: true,
        attempt: { status: 'completed', startedAt: { gte: fourteenDaysAgo } },
      },
      select: {
        points: true,
        awarded: true,
        isCorrect: true,
        explanation: true,
      },
      take: 5000,
    }),
    prisma.user.count({ where: { role: 'STUDENT' } }),
  ]);

  const byDay = new Map<string, { total: number; completed: number; abandoned: number; scoreSum: number; scoreN: number }>();
  for (const s of sessions) {
    const key = new Date(s.startedAt).toISOString().slice(0, 10);
    const row = byDay.get(key) || { total: 0, completed: 0, abandoned: 0, scoreSum: 0, scoreN: 0 };
    row.total += 1;
    if (s.status === 'completed') row.completed += 1;
    if (s.status === 'abandoned') row.abandoned += 1;
    if (s.score != null && s.totalPoints) {
      row.scoreSum += (s.score / s.totalPoints) * 100;
      row.scoreN += 1;
    }
    byDay.set(key, row);
  }
  const daySeries = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date,
      label: new Date(date + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      ...v,
      avgPct: v.scoreN ? Math.round(v.scoreSum / v.scoreN) : null,
    }));

  const byCourse = new Map<string, { code: string; title: string; n: number; scoreSum: number; scoreN: number }>();
  for (const s of sessions) {
    if (!s.courseId || !s.course) continue;
    const row = byCourse.get(s.courseId) || {
      code: s.course.code,
      title: s.course.title,
      n: 0,
      scoreSum: 0,
      scoreN: 0,
    };
    row.n += 1;
    if (s.score != null && s.totalPoints) {
      row.scoreSum += (s.score / s.totalPoints) * 100;
      row.scoreN += 1;
    }
    byCourse.set(s.courseId, row);
  }
  const courseRows = [...byCourse.values()]
    .map((c) => ({ ...c, avgPct: c.scoreN ? Math.round(c.scoreSum / c.scoreN) : null }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 10);

  const topicBuckets = new Map<string, { label: string; points: number; awarded: number; count: number }>();
  for (const a of answers) {
    const meta = unpackQuestionMeta(a.explanation);
    const label = meta.topic && meta.topic !== 'General' ? meta.topic : null;
    if (!label) continue;
    const key = label.toLowerCase();
    const row = topicBuckets.get(key) || { label, points: 0, awarded: 0, count: 0 };
    row.points += a.points || 1;
    row.awarded += a.awarded ?? (a.isCorrect ? a.points || 1 : 0);
    row.count += 1;
    topicBuckets.set(key, row);
  }
  const weakTopics = [...topicBuckets.values()]
    .filter((t) => t.count >= 3)
    .map((t) => ({
      label: t.label,
      answered: t.count,
      accuracyPct: Math.round((t.awarded / Math.max(1, t.points)) * 100),
    }))
    .sort((a, b) => a.accuracyPct - b.accuracyPct)
    .slice(0, 12);

  const total = sessions.length;
  const completed = sessions.filter((s) => s.status === 'completed').length;
  const abandoned = sessions.filter((s) => s.status === 'abandoned').length;
  const scored = sessions.filter((s) => s.score != null && s.totalPoints);
  const avgScore = scored.length
    ? Math.round(scored.reduce((s, x) => s + (x.score! / x.totalPoints!) * 100, 0) / scored.length)
    : null;
  const maxDay = Math.max(1, ...daySeries.map((d) => d.total));

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-8">
      <header className="studio-rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            href="/admin"
            className="inline-flex items-center gap-1 text-xs font-medium text-studio-muted hover:text-studio-fg"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to admin
          </Link>
          <h1 className="mt-2 flex items-center gap-2 font-studio-display text-2xl tracking-tight text-studio-fg sm:text-3xl">
            <BarChart3 className="h-7 w-7 text-studio-primary" />
            CBT analytics
          </h1>
          <p className="mt-1 text-sm text-studio-muted">Last 14 days · {students} students on platform</p>
        </div>
      </header>

      <section className="studio-rise grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Attempts', value: String(total), hint: '14-day window' },
          { label: 'Completed', value: String(completed), hint: total ? `${Math.round((completed / total) * 100)}%` : '—' },
          { label: 'Abandoned', value: String(abandoned), hint: total ? `${Math.round((abandoned / total) * 100)}%` : '—' },
          { label: 'Avg score', value: avgScore !== null ? `${avgScore}%` : '—', hint: `${scored.length} scored` },
        ].map((k) => (
          <div key={k.label} className="rounded-2xl bg-studio-surface p-4 shadow-studio-border sm:p-5">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-studio-subtle">{k.label}</p>
            <p className="tnum mt-1.5 font-studio-display text-2xl text-studio-fg">{k.value}</p>
            <p className="mt-1 text-xs text-studio-muted">{k.hint}</p>
          </div>
        ))}
      </section>

      <section className="studio-rise rounded-2xl bg-studio-surface p-5 shadow-studio-border sm:p-6">
        <h2 className="flex items-center gap-2 font-studio-display text-xl tracking-tight text-studio-fg">
          <TrendingUp className="h-4 w-4 text-studio-primary" />
          Attempts per day
        </h2>
        {daySeries.length === 0 ? (
          <p className="mt-6 rounded-xl border border-dashed border-studio-border-strong px-4 py-10 text-center text-sm text-studio-subtle">
            No CBT activity in the last 14 days.
          </p>
        ) : (
          <div className="mt-6 flex h-40 items-end gap-1.5 sm:gap-2">
            {daySeries.map((d) => (
              <div key={d.date} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                <span className="tnum text-[10px] text-studio-subtle">{d.total || ''}</span>
                <div
                  className="w-full max-w-[2rem] rounded-t-md bg-studio-primary/80"
                  style={{ height: `${Math.max(4, (d.total / maxDay) * 100)}%` }}
                  title={`${d.label}: ${d.total} attempts${d.avgPct != null ? `, avg ${d.avgPct}%` : ''}`}
                />
                <span className="truncate text-[9px] text-studio-subtle">{d.label}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="studio-rise grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl bg-studio-surface p-5 shadow-studio-border sm:p-6">
          <h2 className="flex items-center gap-2 font-studio-display text-xl tracking-tight text-studio-fg">
            <Users className="h-4 w-4 text-studio-primary" />
            By course
          </h2>
          {courseRows.length === 0 ? (
            <p className="mt-4 text-sm text-studio-subtle">No course-linked attempts yet.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {courseRows.map((c) => (
                <li key={c.code} className="flex items-center justify-between gap-3 rounded-xl bg-studio-elevated px-3.5 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-studio-fg">{c.code}</p>
                    <p className="truncate text-xs text-studio-subtle">{c.title}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="tnum text-sm font-medium text-studio-fg">{c.n}</p>
                    <p className="text-xs text-studio-subtle">{c.avgPct != null ? `${c.avgPct}% avg` : '—'}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl bg-studio-surface p-5 shadow-studio-border sm:p-6">
          <h2 className="flex items-center gap-2 font-studio-display text-xl tracking-tight text-studio-fg">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            Platform weak topics
          </h2>
          <p className="mt-1 text-sm text-studio-muted">Lowest accuracy across graded answers (min 3)</p>
          {weakTopics.length === 0 ? (
            <p className="mt-4 text-sm text-studio-subtle">
              Not enough topic-tagged answers yet. Generate Phase A questions to populate this.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {weakTopics.map((t) => (
                <li key={t.label} className="rounded-xl bg-studio-elevated px-3.5 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-studio-fg">{t.label}</p>
                    <span className="tnum shrink-0 text-sm font-semibold text-rose-400">{t.accuracyPct}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-studio-surface">
                    <div
                      className="h-full rounded-full bg-rose-500/80"
                      style={{ width: `${Math.min(100, t.accuracyPct)}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-studio-subtle">{t.answered} answers</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
