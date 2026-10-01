import { redirect, notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { ArrowLeft, User, Brain, BookOpen, Clock } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { getWeakTopics } from '@/lib/weak-topics';

export default async function AdminStudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role !== 'ADMIN') redirect('/dashboard');

  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      matricNumber: true,
      university: true,
      faculty: true,
      department: true,
      level: true,
      semester: true,
      subscriptionTier: true,
      walletBalance: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });
  if (!user || user.role !== 'STUDENT') notFound();

  const [attempts, notes, weakTopics, attemptCount, completedCount] = await Promise.all([
    prisma.examSession.findMany({
      where: { userId: id },
      orderBy: { startedAt: 'desc' },
      take: 15,
      select: {
        id: true,
        status: true,
        mode: true,
        score: true,
        totalPoints: true,
        startedAt: true,
        sourceTitle: true,
        course: { select: { code: true, title: true } },
      },
    }),
    prisma.note.findMany({
      where: { userId: id },
      orderBy: { updatedAt: 'desc' },
      take: 8,
      select: { id: true, title: true, updatedAt: true, course: { select: { code: true } } },
    }),
    getWeakTopics(id, 8),
    prisma.examSession.count({ where: { userId: id } }),
    prisma.examSession.count({ where: { userId: id, status: 'completed' } }),
  ]);

  const scored = attempts.filter((a) => a.score != null && a.totalPoints);
  const avg =
    scored.length > 0
      ? Math.round(scored.reduce((s, a) => s + (a.score! / a.totalPoints!) * 100, 0) / scored.length)
      : null;
  const trend = [...attempts]
    .reverse()
    .filter((a) => a.score != null && a.totalPoints)
    .map((a) => Math.round((a.score! / a.totalPoints!) * 100));

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-8">
      <header className="studio-rise">
        <Link
          href="/admin/students"
          className="inline-flex items-center gap-1 text-xs font-medium text-studio-muted hover:text-studio-fg"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All students
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 font-studio-display text-2xl tracking-tight text-studio-fg">
              <User className="h-6 w-6 text-studio-primary" />
              {user.fullName}
            </h1>
            <p className="mt-1 text-sm text-studio-muted">{user.email}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-studio-subtle">
              <span>{user.matricNumber}</span>
              <span>·</span>
              <span>
                {user.university} · {user.faculty} · {user.department}
              </span>
              <span>·</span>
              <span>
                Level {user.level} · {user.semester}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="indigo">{user.subscriptionTier}</Badge>
            <Badge tone="purple">STUDENT</Badge>
          </div>
        </div>
      </header>

      <section className="studio-rise grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Attempts', value: String(attemptCount) },
          { label: 'Completed', value: String(completedCount) },
          { label: 'Avg score', value: avg !== null ? `${avg}%` : '—' },
          { label: 'Wallet', value: formatCurrency(user.walletBalance) },
        ].map((k) => (
          <div key={k.label} className="rounded-2xl bg-studio-surface p-4 shadow-studio-border">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-studio-subtle">{k.label}</p>
            <p className="tnum mt-1 font-studio-display text-xl text-studio-fg">{k.value}</p>
          </div>
        ))}
      </section>

      <p className="studio-rise text-xs text-studio-subtle">
        <Clock className="mr-1 inline h-3 w-3" />
        Joined {new Date(user.createdAt).toLocaleDateString()}
        {user.lastLoginAt
          ? ` · Last login ${new Date(user.lastLoginAt).toLocaleString()}`
          : ' · Never logged in'}
      </p>

      {trend.length > 1 && (
        <section className="studio-rise rounded-2xl bg-studio-surface p-5 shadow-studio-border">
          <h2 className="font-studio-display text-lg text-studio-fg">Score trend (recent)</h2>
          <div className="mt-4 flex h-24 items-end gap-1.5">
            {trend.map((pct, i) => (
              <div
                key={i}
                className="flex-1 rounded-t bg-studio-primary/80"
                style={{ height: `${Math.max(8, pct)}%` }}
                title={`${pct}%`}
              />
            ))}
          </div>
        </section>
      )}

      <section className="studio-rise grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl bg-studio-surface p-5 shadow-studio-border">
          <h2 className="flex items-center gap-2 font-studio-display text-lg text-studio-fg">
            <Brain className="h-4 w-4 text-studio-primary" /> CBT history
          </h2>
          {attempts.length === 0 ? (
            <p className="mt-4 text-sm text-studio-subtle">No attempts yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {attempts.map((a) => {
                const pct =
                  a.score != null && a.totalPoints
                    ? Math.round((a.score / a.totalPoints) * 100)
                    : null;
                return (
                  <li key={a.id} className="rounded-xl bg-studio-elevated px-3.5 py-2.5">
                    <div className="flex justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-studio-fg">
                          {a.sourceTitle || a.course?.code || 'Document exam'}
                        </p>
                        <p className="text-xs text-studio-subtle">
                          {a.mode} · {new Date(a.startedAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge tone={a.status === 'completed' ? 'purple' : 'amber'}>{a.status}</Badge>
                        {pct !== null && <p className="tnum mt-1 text-xs text-studio-muted">{pct}%</p>}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl bg-studio-surface p-5 shadow-studio-border">
            <h2 className="font-studio-display text-lg text-studio-fg">Weak topics</h2>
            {weakTopics.length === 0 ? (
              <p className="mt-3 text-sm text-studio-subtle">No weak topics detected.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {weakTopics.map((t) => (
                  <li key={t.key} className="flex justify-between rounded-lg bg-studio-elevated px-3 py-2 text-sm">
                    <span className="truncate text-studio-fg">{t.label}</span>
                    <span className="tnum shrink-0 text-rose-400">{t.accuracyPct}%</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl bg-studio-surface p-5 shadow-studio-border">
            <h2 className="flex items-center gap-2 font-studio-display text-lg text-studio-fg">
              <BookOpen className="h-4 w-4 text-studio-primary" /> Notes
            </h2>
            {notes.length === 0 ? (
              <p className="mt-3 text-sm text-studio-subtle">No notes.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {notes.map((n) => (
                  <li key={n.id} className="rounded-lg bg-studio-elevated px-3 py-2 text-sm">
                    <p className="font-medium text-studio-fg">{n.title}</p>
                    <p className="text-xs text-studio-subtle">
                      {n.course?.code || 'General'} · {new Date(n.updatedAt).toLocaleDateString()}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
