import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { CourseForm } from '@/components/dashboard/course-form';
import { GraduationCap } from 'lucide-react';

export default async function CoursesPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const canCreate = session.role === 'LECTURER' || session.role === 'ADMIN' || session.role === 'SUPER_ADMIN';

  const courses = await prisma.course.findMany({
    include: { _count: { select: { notes: true, questions: true } }, lecturer: { select: { fullName: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight">Courses</h1><p className="text-sm text-lipro-600/70 dark:text-lipro-200/70">Browse and manage academy courses</p></div>
      </div>
      {canCreate && <CourseForm />}
      {courses.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-lipro-300/50 py-16 text-center dark:border-lipro-700/40">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-lipro-100 text-lipro-600 dark:bg-lipro-950/60 dark:text-lipro-300">
            <GraduationCap className="h-6 w-6" />
          </div>
          <div>
            <p className="font-medium">No courses yet</p>
            <p className="mt-1 text-sm text-lipro-600/60 dark:text-lipro-300/60">
              {canCreate ? 'Add your first course to get started.' : 'Check back once a lecturer adds a course.'}
            </p>
          </div>
        </div>
      ) : (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {courses.map((c) => (
          <Link key={c.id} href={`/courses/${c.id}`}>
            <Card className="h-full">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <Badge tone="purple">{c.code}</Badge>
                  <span className="text-xs text-lipro-600/60">L{c.level} · {c.semester}</span>
                </div>
                <CardTitle className="mt-2 text-base">{c.title}</CardTitle>
                <CardDescription>{c.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-lipro-600/60">By {c.lecturer.fullName}</span>
                  <div className="flex gap-2"><Badge tone="indigo">{c._count.notes} notes</Badge><Badge tone="amber">{c._count.questions} Qs</Badge></div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
      )}
    </div>
  );
}
