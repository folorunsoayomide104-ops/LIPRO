import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';

export default async function NotificationsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const notifications = await prisma.notification.findMany({ where: { userId: session.userId }, orderBy: { createdAt: 'desc' }, take: 50 });
  // Mark read after fetching (not before) so the "New" badges below still
  // reflect what was actually unread at the moment the student opened this
  // page, while the nav bell's count clears on their next navigation.
  await prisma.notification.updateMany({ where: { userId: session.userId, isRead: false }, data: { isRead: true } });
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold tracking-tight">Notifications</h1><p className="text-sm text-lipro-600/70 dark:text-lipro-200/70">Stay informed about your activity</p></div>
      <Card><CardContent>
        <div className="space-y-2">
          {notifications.length === 0 && <p className="text-sm text-lipro-600/60">No notifications.</p>}
          {notifications.map((n) => (
            <div key={n.id} className="rounded-xl p-3 glass-hover">
              <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Badge tone={n.type === 'PAYMENT' ? 'green' : n.type === 'ANNOUNCEMENT' ? 'indigo' : n.type === 'ACADEMIC' ? 'indigo' : n.type === 'WARNING' ? 'amber' : 'purple'}>{n.type === 'ANNOUNCEMENT' ? 'Announcement' : n.type}</Badge>{!n.isRead && <Badge tone="rose">New</Badge>}</div><span className="text-xs text-lipro-600/60">{formatDate(n.createdAt)}</span></div>
              <div className="mt-1 text-sm font-medium">{n.title}</div>
              <p className="text-xs text-lipro-600/70 dark:text-lipro-200/70 mt-0.5">{n.message}</p>
            </div>
          ))}
        </div>
      </CardContent></Card>
    </div>
  );
}