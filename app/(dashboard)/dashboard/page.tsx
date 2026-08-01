import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';

export default async function DashboardIndex() {
  const session = await getSession();
  if (!session) redirect('/login');
  redirect({
    STUDENT: '/student',
    LECTURER: '/lecturer',
    ADMIN: '/admin',
    SUPER_ADMIN: '/super-admin',
  }[session.role]);
}
