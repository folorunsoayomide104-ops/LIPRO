import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { AnnouncementForm } from '@/components/admin/announcement-form';
import { ArrowLeft } from 'lucide-react';

export default async function AdminAnnouncementsPage() {
  const [faculties, departments, levels, semesters] = await Promise.all([
    prisma.user.findMany({ where: { role: 'STUDENT' }, distinct: ['faculty'], select: { faculty: true }, orderBy: { faculty: 'asc' } }),
    prisma.user.findMany({ where: { role: 'STUDENT' }, distinct: ['department'], select: { department: true }, orderBy: { department: 'asc' } }),
    prisma.user.findMany({ where: { role: 'STUDENT' }, distinct: ['level'], select: { level: true }, orderBy: { level: 'asc' } }),
    prisma.user.findMany({ where: { role: 'STUDENT' }, distinct: ['semester'], select: { semester: true }, orderBy: { semester: 'asc' } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin" className="inline-flex items-center gap-1 text-sm font-medium text-lipro-600/70 hover:underline dark:text-lipro-300/70">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Admin
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Announcements</h1>
        <p className="text-sm text-lipro-600/70 dark:text-lipro-200/70">
          Send a message straight to student dashboards — everyone, or filtered by faculty, department, level, and semester.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle>New announcement</CardTitle><CardDescription>Appears in each matching student&apos;s notifications</CardDescription></CardHeader>
        <CardContent>
          <AnnouncementForm
            faculties={faculties.map((f) => f.faculty)}
            departments={departments.map((d) => d.department)}
            levels={levels.map((l) => l.level)}
            semesters={semesters.map((s) => s.semester)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
