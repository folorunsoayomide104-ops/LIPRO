import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';
import { Bell, CheckCheck } from 'lucide-react';
import Link from 'next/link';
import { MarkAllReadButton } from '@/components/notifications/mark-all-read';

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');
  const sp = await searchParams;
  const filter = sp.type || 'all';

  const where: { userId: string; type?: string | { not: string } } = {
    userId: session.userId,
  };
  if (session.role !== 'ADMIN') {
    where.type = { not: 'AUDIT' };
  } else if (filter === 'audit') {
    where.type = 'AUDIT';
  } else if (filter === 'announcement') {
    where.type = 'ANNOUNCEMENT';
  } else if (filter === 'payment') {
    where.type = 'PAYMENT';
  }

  const notifications = await prisma.notification.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 80,
  });

  const unread = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-studio-display text-2xl tracking-tight text-studio-fg">
            <Bell className="h-6 w-6 text-studio-primary" />
            Notifications
          </h1>
          <p className="mt-1 text-sm text-studio-muted">
            {unread > 0 ? `${unread} unread` : 'You are up to date'}
          </p>
        </div>
        <MarkAllReadButton />
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { key: 'all', label: 'All' },
          { key: 'announcement', label: 'Announcements' },
          { key: 'payment', label: 'Payments' },
          ...(session.role === 'ADMIN' ? [{ key: 'audit', label: 'Audit' }] : []),
        ].map((t) => (
          <Link
            key={t.key}
            href={t.key === 'all' ? '/notifications' : `/notifications?type=${t.key}`}
            className={`rounded-full px-3 py-1.5 text-xs font-medium shadow-studio-border ${
              filter === t.key
                ? 'bg-studio-primary text-studio-primary-fg'
                : 'bg-studio-elevated text-studio-muted hover:text-studio-fg'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="space-y-2">
            {notifications.length === 0 && (
              <div className="rounded-xl border border-dashed border-studio-border-strong px-4 py-12 text-center">
                <CheckCheck className="mx-auto h-6 w-6 text-studio-subtle" />
                <p className="mt-2 text-sm font-medium text-studio-muted">No notifications here</p>
                <p className="mt-1 text-xs text-studio-subtle">
                  Announcements and system updates will show up in this feed.
                </p>
              </div>
            )}
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`rounded-xl p-3 ${n.isRead ? 'bg-studio-elevated/50' : 'bg-studio-elevated shadow-studio-border'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      tone={
                        n.type === 'PAYMENT'
                          ? 'green'
                          : n.type === 'ANNOUNCEMENT'
                            ? 'indigo'
                            : n.type === 'AUDIT'
                              ? 'amber'
                              : n.type === 'WARNING'
                                ? 'amber'
                                : 'purple'
                      }
                    >
                      {n.type === 'ANNOUNCEMENT'
                        ? 'Announcement'
                        : n.type === 'AUDIT'
                          ? 'Audit'
                          : n.type}
                    </Badge>
                    {!n.isRead && <Badge tone="rose">New</Badge>}
                  </div>
                  <span className="shrink-0 text-xs text-studio-subtle">{formatDate(n.createdAt)}</span>
                </div>
                <div className="mt-1 text-sm font-medium text-studio-fg">{n.title}</div>
                <p className="mt-0.5 text-xs text-studio-subtle">{n.message}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
