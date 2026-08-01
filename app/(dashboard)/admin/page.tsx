import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, BookOpen, Brain, Wallet } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

export default async function AdminDashboard() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') redirect('/dashboard');

  const [students, lecturers, courses, questions, totalWallet, recentUsers] = await Promise.all([
    prisma.user.count({ where: { role: 'STUDENT' } }),
    prisma.user.count({ where: { role: 'LECTURER' } }),
    prisma.course.count(),
    prisma.question.count(),
    prisma.user.aggregate({ _sum: { walletBalance: true } }),
    prisma.user.findMany({ orderBy: { createdAt: 'desc' }, take: 6, select: { id: true, fullName: true, email: true, role: true, university: true, createdAt: true } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card><CardHeader><CardDescription>Students</CardDescription><CardTitle className="text-2xl flex items-center gap-2"><Users className="h-5 w-5 text-lipro-500" /> {students}</CardTitle></CardHeader></Card>
        <Card><CardHeader><CardDescription>Lecturers</CardDescription><CardTitle className="text-2xl">{lecturers}</CardTitle></CardHeader></Card>
        <Card><CardHeader><CardDescription>Courses</CardDescription><CardTitle className="text-2xl flex items-center gap-2"><BookOpen className="h-5 w-5 text-lipro-500" /> {courses}</CardTitle></CardHeader></Card>
        <Card><CardHeader><CardDescription>Questions</CardDescription><CardTitle className="text-2xl flex items-center gap-2"><Brain className="h-5 w-5 text-lipro-500" /> {questions}</CardTitle></CardHeader></Card>
        <Card><CardHeader><CardDescription>Wallet volume</CardDescription><CardTitle className="text-2xl flex items-center gap-2"><Wallet className="h-5 w-5 text-lipro-500" /> {formatCurrency(totalWallet._sum.walletBalance || 0)}</CardTitle></CardHeader></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Recent registrations</CardTitle><CardDescription>Latest users on the platform</CardDescription></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-lipro-200/30 text-left text-xs uppercase tracking-wide text-lipro-700/70 dark:text-lipro-200/70"><th className="py-2">Name</th><th>Email</th><th>Role</th><th>University</th><th>Joined</th></tr></thead>
              <tbody>
                {recentUsers.map((u) => (
                  <tr key={u.id} className="border-b border-lipro-200/10 last:border-0">
                    <td className="py-2 font-medium">{u.fullName}</td>
                    <td>{u.email}</td>
                    <td><Badge tone={u.role === 'STUDENT' ? 'purple' : u.role === 'LECTURER' ? 'indigo' : 'amber'}>{u.role}</Badge></td>
                    <td className="text-lipro-600/60 dark:text-lipro-200/60">{u.university}</td>
                    <td className="text-lipro-600/60 dark:text-lipro-200/60">{new Date(u.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
