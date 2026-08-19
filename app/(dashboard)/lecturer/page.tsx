import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { BookOpen, Brain, Users, ArrowRight, Plus } from 'lucide-react';

export default async function LecturerDashboard() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role !== 'LECTURER') redirect('/dashboard');

  const [courses, questions, attempts] = await Promise.all([
    prisma.course.findMany({
      where: { lecturerId: session.userId },
      include: { _count: { select: { notes: true, questions: true, examSessions: true } }, lecturer: { select: { fullName: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.question.count({ where: { authorId: session.userId } }),
    prisma.examSession.count({ where: { course: { lecturerId: session.userId } } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardHeader><CardDescription>Your courses</CardDescription><CardTitle className="text-2xl">{courses.length}</CardTitle></CardHeader><CardContent><Link href="/courses" className="text-xs font-medium text-lipro-600 hover:underline inline-flex items-center gap-1">Manage courses <ArrowRight className="h-3 w-3" /></Link></CardContent></Card>
        <Card><CardHeader><CardDescription>Questions authored</CardDescription><CardTitle className="text-2xl">{questions}</CardTitle></CardHeader><CardContent><span className="text-xs text-lipro-600/70 dark:text-lipro-200/70">Across all your courses</span></CardContent></Card>
        <Card><CardHeader><CardDescription>Student attempts</CardDescription><CardTitle className="text-2xl">{attempts}</CardTitle></CardHeader><CardContent><span className="text-xs text-lipro-600/70 dark:text-lipro-200/70">CBT sessions on your courses</span></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your courses</CardTitle>
          <CardDescription>Manage materials, questions and exams</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {courses.length === 0 && (
              <div className="text-sm text-lipro-600/60">You have not created any courses yet. <Link href="/courses" className="text-lipro-600 underline">Create your first course</Link>.</div>
            )}
            {courses.map((c) => (
              <Link key={c.id} href={`/courses/${c.id}`} className="block rounded-xl p-4 glass-hover">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{c.code} · {c.title}</div>
                    <div className="truncate text-xs text-lipro-600/60 mt-0.5">{c.faculty} / {c.department} / Level {c.level} / {c.semester}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge tone="purple">{c._count.notes} notes</Badge>
                    <Badge tone="indigo">{c._count.questions} Qs</Badge>
                    <Badge tone="amber">{c._count.examSessions} attempts</Badge>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
