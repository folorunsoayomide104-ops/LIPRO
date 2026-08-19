import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';

export default async function DashboardIndex() {
  const session = await getSession();
  if (!session) redirect('/login');
  redirect({
    STUDENT: '/student',
    ADMIN: '/admin',
  }[session.role]);
}
