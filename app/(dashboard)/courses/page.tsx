import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { CourseForm } from '@/components/dashboard/course-form';

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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {courses.length === 0 && <p className="text-sm text-lipro-600/60">No courses yet.</p>}
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
    </div>
  );
}
