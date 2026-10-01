import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import type { ComponentType } from 'react';
import {
  Users,
  BookOpen,
  Brain,
  Wallet,
  ShieldCheck,
  ArrowRight,
  Activity,
  ClipboardList,
  FileText,
  Megaphone,
  GraduationCap,
  UserPlus,
  TrendingUp,
  Layers,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-2xl bg-studio-surface p-4 shadow-studio-border sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-studio-subtle">{label}</p>
          <p className="tnum mt-1.5 font-studio-display text-2xl tracking-tight text-studio-fg sm:text-[1.75rem]">
            {value}
          </p>
          {hint && <p className="mt-1 text-xs text-studio-muted">{hint}</p>}
        </div>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-studio-elevated text-studio-primary shadow-studio-border">
          <Icon className="h-4 w-4" />
        </span>
      </div>
    </div>
  );
}

function ActionCard({
  title,
  description,
  href,
  icon: Icon,
}: {
  title: string;
  description: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col rounded-2xl bg-studio-surface p-5 shadow-studio-border transition-colors hover:bg-studio-elevated/40 sm:p-6"
    >
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-studio-elevated text-studio-primary shadow-studio-border">
        <Icon className="h-5 w-5" />
      </span>
      <h3 className="mt-4 font-studio-display text-lg tracking-tight text-studio-fg">{title}</h3>
      <p className="mt-1 flex-1 text-sm leading-relaxed text-studio-muted">{description}</p>
      <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-studio-primary">
        Open <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

export default async function AdminDashboard() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role !== 'ADMIN') redirect('/dashboard');

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    students,
    admins,
    courses,
    questions,
    materials,
    notes,
    totalWallet,
    recentUsers,
    activeThisWeek,
    newStudents30d,
    cbtTotal,
    cbtCompleted,
    cbtThisWeek,
    recentSessions,
  ] = await Promise.all([
    prisma.user.count({ where: { role: 'STUDENT' } }),
    prisma.user.count({ where: { role: 'ADMIN' } }),
    prisma.course.count(),
    prisma.question.count(),
    prisma.material.count(),
    prisma.note.count(),
    prisma.user.aggregate({ _sum: { walletBalance: true } }),
    prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        university: true,
        level: true,
        createdAt: true,
        lastLoginAt: true,
      },
    }),
    prisma.user.count({ where: { role: 'STUDENT', lastLoginAt: { gte: sevenDaysAgo } } }),
    prisma.user.count({ where: { role: 'STUDENT', createdAt: { gte: thirtyDaysAgo } } }),
    prisma.examSession.count(),
    prisma.examSession.count({ where: { status: 'completed' } }),
    prisma.examSession.count({ where: { startedAt: { gte: sevenDaysAgo } } }),
    prisma.examSession.findMany({
      orderBy: { startedAt: 'desc' },
      take: 6,
      select: {
        id: true,
        status: true,
        score: true,
        totalPoints: true,
        mode: true,
        startedAt: true,
        user: { select: { fullName: true, email: true } },
        course: { select: { code: true, title: true } },
      },
    }),
  ]);

  const walletSum = totalWallet._sum.walletBalance ?? 0;
  const activeRate = students > 0 ? Math.round((activeThisWeek / students) * 100) : 0;
  const completionRate = cbtTotal > 0 ? Math.round((cbtCompleted / cbtTotal) * 100) : 0;

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-8">
      <header className="studio-rise flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-studio-subtle">
            Platform control
          </p>
          <h1 className="mt-1 flex items-center gap-2 font-studio-display text-2xl tracking-tight text-studio-fg sm:text-3xl">
            <ShieldCheck className="h-7 w-7 text-studio-primary" />
            Admin dashboard
          </h1>
          <p className="mt-2 text-sm text-studio-muted">
            Signed in as <span className="font-medium text-studio-fg">{session.email}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin/students"
            className="inline-flex h-10 items-center gap-1.5 rounded-full bg-studio-elevated px-4 text-sm font-medium text-studio-muted shadow-studio-border transition-colors hover:text-studio-fg"
          >
            <Users className="h-4 w-4" />
            Students
          </Link>
          <Link
            href="/admin/announcements"
            className="inline-flex h-10 items-center gap-1.5 rounded-full bg-studio-primary px-4 text-sm font-semibold text-studio-primary-fg shadow-md transition-transform hover:scale-[1.02] active:scale-95"
          >
            <Megaphone className="h-4 w-4" />
            Announce
          </Link>
        </div>
      </header>

      <section className="studio-rise studio-rise-delay-1 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Students"
          value={String(students)}
          hint={`${activeThisWeek} active in 7 days · ${activeRate}%`}
          icon={Users}
        />
        <StatCard
          label="New (30d)"
          value={String(newStudents30d)}
          hint={`${admins} admin account${admins === 1 ? '' : 's'}`}
          icon={UserPlus}
        />
        <StatCard
          label="CBT attempts"
          value={String(cbtTotal)}
          hint={`${cbtThisWeek} this week · ${completionRate}% completed`}
          icon={ClipboardList}
        />
        <StatCard
          label="Wallet float"
          value={formatCurrency(walletSum)}
          hint="Sum of student balances"
          icon={Wallet}
        />
      </section>

      <section className="studio-rise studio-rise-delay-2 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Courses" value={String(courses)} hint="Published catalogue" icon={BookOpen} />
        <StatCard label="Questions" value={String(questions)} hint="CBT question bank" icon={Brain} />
        <StatCard label="Materials" value={String(materials)} hint="Uploaded documents" icon={Layers} />
        <StatCard label="Notes" value={String(notes)} hint="Student revision notes" icon={FileText} />
      </section>

      <section className="studio-rise studio-rise-delay-2">
        <div className="mb-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-studio-subtle">Shortcuts</p>
          <h2 className="mt-1 font-studio-display text-xl tracking-tight text-studio-fg">Quick actions</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ActionCard
            title="Students"
            description="Search accounts, review profiles, and monitor engagement."
            href="/admin/students"
            icon={Users}
          />
          <ActionCard
            title="Courses"
            description="Create courses, manage materials, and author questions."
            href="/courses"
            icon={GraduationCap}
          />
          <ActionCard
            title="Announcements"
            description="Push a message to student dashboards and notice feeds."
            href="/admin/announcements"
            icon={Megaphone}
          />
          <ActionCard
            title="CBT overview"
            description="Open the CBT area to inspect practice and exam flows."
            href="/cbt"
            icon={Brain}
          />
        </div>
      </section>

      <section className="studio-rise studio-rise-delay-3 grid gap-4 lg:grid-cols-5">
        <div className="rounded-2xl bg-studio-surface p-5 shadow-studio-border sm:p-6 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-studio-subtle">Activity</p>
              <h2 className="mt-1 flex items-center gap-2 font-studio-display text-xl tracking-tight text-studio-fg">
                <Activity className="h-4 w-4 text-studio-primary" />
                Recent CBT
              </h2>
            </div>
            <span className="rounded-full bg-studio-elevated px-2.5 py-1 text-[11px] font-medium text-studio-muted shadow-studio-border">
              {cbtThisWeek} / 7d
            </span>
          </div>

          {recentSessions.length === 0 ? (
            <p className="rounded-xl border border-dashed border-studio-border-strong px-4 py-8 text-center text-sm text-studio-subtle">
              No CBT attempts yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {recentSessions.map((s) => {
                const pct =
                  s.score != null && s.totalPoints
                    ? Math.round((s.score / s.totalPoints) * 100)
                    : null;
                return (
                  <li
                    key={s.id}
                    className="rounded-xl bg-studio-elevated px-3.5 py-3 shadow-studio-border"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-studio-fg">
                          {s.user.fullName || s.user.email}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-studio-subtle">
                          {s.course?.code || 'Document exam'} · {s.mode}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <Badge
                          tone={
                            s.status === 'completed'
                              ? 'purple'
                              : s.status === 'abandoned'
                                ? 'amber'
                                : 'indigo'
                          }
                        >
                          {s.status}
                        </Badge>
                        {pct !== null && (
                          <p className="tnum mt-1 text-xs font-medium text-studio-muted">{pct}%</p>
                        )}
                      </div>
                    </div>
                    <p className="mt-1.5 text-[11px] text-studio-subtle">
                      {new Date(s.startedAt).toLocaleString(undefined, {
                        day: 'numeric',
                        month: 'short',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="rounded-2xl bg-studio-surface p-5 shadow-studio-border sm:p-6 lg:col-span-3">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-studio-subtle">Growth</p>
              <h2 className="mt-1 flex items-center gap-2 font-studio-display text-xl tracking-tight text-studio-fg">
                <TrendingUp className="h-4 w-4 text-studio-primary" />
                Recent registrations
              </h2>
            </div>
            <Link
              href="/admin/students"
              className="inline-flex items-center gap-1 text-xs font-semibold text-studio-primary hover:underline"
            >
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead>
                <tr className="border-b border-studio-border text-[11px] uppercase tracking-wide text-studio-subtle">
                  <th className="pb-2 pr-3 font-medium">Name</th>
                  <th className="pb-2 pr-3 font-medium">Email</th>
                  <th className="pb-2 pr-3 font-medium">Role</th>
                  <th className="pb-2 pr-3 font-medium">University</th>
                  <th className="pb-2 font-medium">Joined</th>
                </tr>
              </thead>
              <tbody>
                {recentUsers.map((u) => (
                  <tr key={u.id} className="border-b border-studio-border/70 last:border-0">
                    <td className="py-2.5 pr-3 font-medium text-studio-fg">{u.fullName}</td>
                    <td className="py-2.5 pr-3 text-studio-muted">{u.email}</td>
                    <td className="py-2.5 pr-3">
                      <Badge tone={u.role === 'ADMIN' ? 'amber' : 'purple'}>{u.role}</Badge>
                    </td>
                    <td className="py-2.5 pr-3 text-studio-subtle">
                      {u.university || '—'}
                      {u.level ? ` · L${u.level}` : ''}
                    </td>
                    <td className="py-2.5 text-studio-subtle">
                      {new Date(u.createdAt).toLocaleDateString(undefined, {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
