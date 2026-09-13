import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import Link from 'next/link';
import { NoteEditor } from '@/components/dashboard/note-editor';
import { QuestionManager } from '@/components/cbt/question-manager';
import { StartExamButton } from '@/components/cbt/start-exam-button';
import { SyllabusEditor } from '@/components/dashboard/syllabus-editor';
import { CourseMaterialsManager } from '@/components/dashboard/course-materials-manager';

export default async function CourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect('/login');
  const { id } = await params;

  const course = await prisma.course.findUnique({
    where: { id },
    include: {
      lecturer: { select: { fullName: true } },
      notes: { orderBy: { updatedAt: 'desc' }, include: { user: { select: { fullName: true } } } },
      questions: {
        orderBy: { createdAt: 'desc' },
        select: { id: true, type: true, question: true, points: true, imageUrl: true, createdAt: true },
      },
      materials: {
        orderBy: { createdAt: 'desc' },
        select: { id: true, originalName: true, sizeBytes: true, createdAt: true },
      },
      _count: { select: { questions: true, notes: true } },
    },
  });
  if (!course) return <div className="p-8">Course not found.</div>;

  const canManage = session.role === 'ADMIN';

  const typeCounts: Record<string, number> = {};
  for (const q of course.questions) {
    typeCounts[q.type] = (typeCounts[q.type] || 0) + 1;
  }

  return (
    <div className="-mx-4 -mt-2 min-h-[calc(100dvh-4rem)] bg-studio-bg p-4 text-studio-fg md:p-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="studio-rise">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-studio-elevated px-2.5 py-1 text-xs font-medium text-studio-primary">{course.code}</span>
            <span className="rounded-full bg-studio-elevated px-2.5 py-1 text-xs font-medium text-studio-muted">L{course.level} · {course.semester}</span>
          </div>
          <h1 className="mt-3 font-studio-display text-3xl tracking-tight md:text-4xl">{course.title}</h1>
          <p className="mt-2 text-sm leading-normal text-studio-muted">{course.description}</p>
          <p className="mt-2 text-xs text-studio-subtle">By {course.lecturer.fullName} · {course.faculty} / {course.department}</p>
        </header>

        <section className="rounded-xl bg-studio-surface p-5 shadow-studio-border studio-rise studio-rise-delay-1">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-studio-subtle">Syllabus</p>
          <p className="mt-1 text-sm text-studio-muted">Course outline and structure.</p>
          <div className="mt-4">
            <SyllabusEditor courseId={course.id} initialSyllabus={course.syllabus} canManage={canManage} />
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-2 studio-rise studio-rise-delay-1">
          <StartExamButton courseId={course.id} typeCounts={typeCounts} />
          <Link href="/lipro-ai" className="inline-flex h-9 items-center rounded-full bg-studio-elevated px-3 text-xs font-medium text-studio-muted shadow-studio-border hover:text-studio-fg">
            Ask LIPRO AI about this course
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-xl bg-studio-surface p-5 shadow-studio-border studio-rise studio-rise-delay-2">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-studio-subtle">Notes ({course.notes.length})</p>
            <p className="mt-1 text-sm text-studio-muted">Course material &amp; your saved notes.</p>
            <div className="mt-4 flex flex-col gap-2">
              {course.notes.map((n) => (
                <div key={n.id} className="rounded-lg bg-studio-elevated p-3">
                  <div className="text-sm font-medium text-studio-fg">{n.title}</div>
                  <div className="mt-0.5 text-xs text-studio-subtle">By {n.user.fullName} · Updated {new Date(n.updatedAt).toLocaleDateString()}</div>
                  <p className="mt-1 line-clamp-2 text-xs text-studio-muted">{n.content}</p>
                </div>
              ))}
              {course.notes.length === 0 && <p className="text-sm text-studio-subtle">No notes yet.</p>}
            </div>
            <div className="mt-4"><NoteEditor courseId={course.id} /></div>
          </section>

          <section className="rounded-xl bg-studio-surface p-5 shadow-studio-border studio-rise studio-rise-delay-2">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-studio-subtle">Question bank ({course.questions.length})</p>
            <p className="mt-1 text-sm text-studio-muted">{canManage ? 'Add and manage CBT questions.' : 'Available questions.'}</p>
            <div className="mt-4 flex flex-col gap-2">
              {course.questions.map((q) => (
                <div key={q.id} className="rounded-lg bg-studio-elevated p-3">
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-studio-surface px-2 py-0.5 text-[11px] font-medium text-studio-muted shadow-studio-border">{q.type}</span>
                    <span className="text-xs text-studio-subtle">{q.points} pts</span>
                  </div>
                  <div className="mt-1 text-sm text-studio-fg">{q.question}</div>
                </div>
              ))}
              {course.questions.length === 0 && <p className="text-sm text-studio-subtle">No questions yet.</p>}
            </div>
            {canManage && <div className="mt-4"><QuestionManager courseId={course.id} /></div>}
          </section>
        </div>

        <section className="rounded-xl bg-studio-surface p-5 shadow-studio-border studio-rise studio-rise-delay-3">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-studio-subtle">Course materials ({course.materials.length})</p>
          <p className="mt-1 text-sm text-studio-muted">{canManage ? 'Upload PDFs and files for this course.' : 'Files shared for this course.'}</p>
          <div className="mt-4">
            <CourseMaterialsManager
              courseId={course.id}
              materials={course.materials.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() }))}
              canManage={canManage}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
