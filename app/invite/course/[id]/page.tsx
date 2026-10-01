import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import Link from 'next/link';
import { Package, LogIn } from 'lucide-react';
import { CoursePackButton } from '@/components/cbt/course-pack-button';
import { StartExamButton } from '@/components/cbt/start-exam-button';

export default async function CourseInvitePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const course = await prisma.course.findUnique({
    where: { id },
    include: {
      _count: { select: { questions: true } },
      lecturer: { select: { fullName: true } },
    },
  });
  if (!course) notFound();

  const session = await getSession();

  const typeGroups = await prisma.question.groupBy({
    by: ['type'],
    where: { courseId: id },
    _count: true,
  });
  const typeCounts: Record<string, number> = {};
  for (const g of typeGroups) typeCounts[g.type] = g._count;

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center gap-6 px-4 py-12">
      <div className="rounded-2xl bg-studio-surface p-6 shadow-studio-border">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-studio-subtle">Shared pack</p>
        <h1 className="mt-2 font-studio-display text-2xl tracking-tight text-studio-fg">{course.code}</h1>
        <p className="mt-1 text-sm text-studio-muted">{course.title}</p>
        <p className="mt-2 text-xs text-studio-subtle">
          By {course.lecturer.fullName} · {course._count.questions} questions in bank
        </p>

        {!session ? (
          <div className="mt-6 space-y-3">
            <p className="text-sm text-studio-muted">Sign in as a student to start this practice pack.</p>
            <Link
              href={`/login?redirect=${encodeURIComponent(`/invite/course/${id}`)}`}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-studio-primary text-sm font-semibold text-studio-primary-fg"
            >
              <LogIn className="h-4 w-4" />
              Log in to continue
            </Link>
          </div>
        ) : (
          <div className="mt-6 flex flex-col gap-3">
            <div className="flex items-center gap-2 text-sm text-studio-muted">
              <Package className="h-4 w-4 text-studio-primary" />
              Choose how to start
            </div>
            <StartExamButton courseId={course.id} typeCounts={typeCounts as any} />
            <CoursePackButton courseId={course.id} questionCount={course._count.questions} />
            <Link href="/cbt" className="text-center text-xs font-medium text-studio-primary hover:underline">
              Or open full CBT home
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
