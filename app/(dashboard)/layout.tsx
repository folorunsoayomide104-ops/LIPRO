import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { LayoutShell } from '@/components/LayoutShell';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login?redirect=/dashboard');
  const roleLabel = {
    STUDENT: 'Student',
    ADMIN: 'Admin',
  }[session.role];
  const unreadCount = await prisma.notification.count({ where: { userId: session.userId, isRead: false } });
  return <LayoutShell roleLabel={roleLabel} isAdmin={session.role === 'ADMIN'} unreadCount={unreadCount}>{children}</LayoutShell>;
}
