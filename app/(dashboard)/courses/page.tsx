import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import Link from 'next/link';
import { CourseForm } from '@/components/dashboard/course-form';
import { GraduationCap } from 'lucide-react';

export default async function CoursesPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const canCreate = session.role === 'ADMIN';

  const courses = await prisma.course.findMany({
    include: { _count: { select: { notes: true, questions: true } }, lecturer: { select: { fullName: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="-mx-4 -mt-2 min-h-[calc(100dvh-4rem)] bg-studio-bg p-4 text-studio-fg md:p-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3 studio-rise">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-studio-subtle">Courses</p>
            <h1 className="mt-2 font-studio-display text-3xl tracking-tight md:text-4xl">Browse the catalogue.</h1>
            <p className="mt-2 max-w-lg text-sm leading-normal text-studio-muted">Browse and manage academy courses.</p>
          </div>
        </div>

        {canCreate && <CourseForm />}

        {courses.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-studio-border-strong py-16 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-studio-elevated text-studio-primary">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div>
              <p className="font-medium text-studio-fg">No courses yet</p>
              <p className="mt-1 text-sm text-studio-subtle">
                {canCreate ? 'Add your first course to get started.' : 'Check back once an admin adds a course.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((c) => (
              <Link key={c.id} href={`/courses/${c.id}`} className="rounded-xl bg-studio-surface p-5 shadow-studio-border transition-shadow hover:shadow-studio-border-hover studio-rise studio-rise-delay-1">
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-studio-elevated px-2.5 py-1 text-xs font-medium text-studio-primary">{c.code}</span>
                  <span className="text-xs text-studio-subtle">L{c.level} · {c.semester}</span>
                </div>
                <h3 className="mt-3 font-studio-display text-lg tracking-tight text-studio-fg">{c.title}</h3>
                <p className="mt-1 line-clamp-2 text-sm text-studio-muted">{c.description}</p>
                <div className="mt-4 flex items-center justify-between text-xs">
                  <span className="text-studio-subtle">By {c.lecturer.fullName}</span>
                  <div className="flex gap-1.5">
                    <span className="rounded-full bg-studio-elevated px-2 py-0.5 text-studio-muted">{c._count.notes} notes</span>
                    <span className="rounded-full bg-studio-elevated px-2 py-0.5 text-studio-muted">{c._count.questions} Qs</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
