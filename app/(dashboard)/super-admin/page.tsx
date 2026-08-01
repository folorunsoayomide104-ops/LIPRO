import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, BookOpen, Brain, Wallet, ShieldCheck } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

export default async function SuperAdminDashboard() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role !== 'SUPER_ADMIN') redirect('/dashboard');

  const [students, lecturers, admins, courses, questions, totalWallet] = await Promise.all([
    prisma.user.count({ where: { role: 'STUDENT' } }),
    prisma.user.count({ where: { role: 'LECTURER' } }),
    prisma.user.count({ where: { role: 'ADMIN' } }),
    prisma.course.count(),
    prisma.question.count(),
    prisma.user.aggregate({ _sum: { walletBalance: true } }),
  ]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-lipro-500" /> Super Admin Control Center</CardTitle>
          <CardDescription>Full platform oversight. Currently signed in as {session.email}.</CardDescription>
        </CardHeader>
      </Card>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
        <Card><CardHeader><CardDescription>Students</CardDescription><CardTitle className="text-2xl">{students}</CardTitle></CardHeader></Card>
        <Card><CardHeader><CardDescription>Lecturers</CardDescription><CardTitle className="text-2xl">{lecturers}</CardTitle></CardHeader></Card>
        <Card><CardHeader><CardDescription>Admins</CardDescription><CardTitle className="text-2xl">{admins}</CardTitle></CardHeader></Card>
        <Card><CardHeader><CardDescription>Courses</CardDescription><CardTitle className="text-2xl">{courses}</CardTitle></CardHeader></Card>
        <Card><CardHeader><CardDescription>Questions</CardDescription><CardTitle className="text-2xl">{questions}</CardTitle></CardHeader></Card>
        <Card><CardHeader><CardDescription>Wallet volume</CardDescription><CardTitle className="text-2xl">{formatCurrency(totalWallet._sum.walletBalance || 0)}</CardTitle></CardHeader></Card>
      </div>
      <Card>
        <CardHeader><CardTitle>System status</CardTitle><CardDescription>Foundation modules wired and working</CardDescription></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {['Auth & JWT', 'RBAC', 'Courses', 'Notes', 'CBT Engine', 'LIPRO AI', 'Paystack', 'Wallet', 'Notifications'].map((m) => (
              <Badge key={m} tone="green">{m}</Badge>
            ))}
          </div>
          <p className="mt-3 text-xs text-lipro-600/60 dark:text-lipro-200/60">Advanced premium modules (PDF intelligence, analytics charts, leaderboard, React Three Fiber 3D, GSAP) slot in on top of this foundation without refactoring.</p>
        </CardContent>
      </Card>
    </div>
  );
}
