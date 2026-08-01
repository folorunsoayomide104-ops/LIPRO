import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { LayoutShell } from '@/components/LayoutShell';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login?redirect=/dashboard');
  const roleLabel = {
    STUDENT: 'Student',
    LECTURER: 'Lecturer',
    ADMIN: 'Admin',
    SUPER_ADMIN: 'Super Admin',
  }[session.role];
  return <LayoutShell roleLabel={roleLabel}>{children}</LayoutShell>;
}
