import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { NoteEditor } from '@/components/dashboard/note-editor';
import { QuestionManager } from '@/components/cbt/question-manager';
import { StartExamButton } from '@/components/cbt/start-exam-button';

export default async function CourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect('/login');
  const { id } = await params;

  const course = await prisma.course.findUnique({
    where: { id },
    include: {
      lecturer: { select: { fullName: true } },
      notes: { orderBy: { updatedAt: 'desc' }, include: { user: { select: { fullName: true } } } },
      // Only the fields the page renders — answer/explanation must not ship to
      // the client for a student browsing the question bank before an exam.
      questions: {
        orderBy: { createdAt: 'desc' },
        select: { id: true, type: true, question: true, points: true, imageUrl: true, createdAt: true },
      },
      _count: { select: { questions: true, notes: true } },
    },
  });
  if (!course) return <div className="p-8">Course not found.</div>;

  const isLecturer = course.lecturerId === session.userId;
  const isAdmin = session.role === 'ADMIN' || session.role === 'SUPER_ADMIN';
  const canManage = isLecturer || isAdmin;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Badge tone="purple">{course.code}</Badge>
          <Badge tone="indigo">L{course.level} · {course.semester}</Badge>
        </div>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">{course.title}</h1>
        <p className="mt-1 text-sm text-lipro-600/70 dark:text-lipro-200/70">{course.description}</p>
        <p className="mt-2 text-xs text-lipro-600/60">By {course.lecturer.fullName} · {course.faculty} / {course.department}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <StartExamButton courseId={course.id} />
        <Link href="/lipro-ai"><Badge tone="purple" className="cursor-pointer">Ask LIPRO AI about this course</Badge></Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Notes ({course.notes.length})</CardTitle><CardDescription>Course material & your saved notes</CardDescription></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {course.notes.map((n) => (
                <div key={n.id} className="rounded-xl p-3 glass-hover">
                  <div className="text-sm font-medium">{n.title}</div>
                  <div className="text-xs text-lipro-600/60 mt-0.5">By {n.user.fullName} · Updated {new Date(n.updatedAt).toLocaleDateString()}</div>
                  <p className="text-xs mt-1 text-lipro-700/70 dark:text-lipro-200/70 line-clamp-2">{n.content}</p>
                </div>
              ))}
              {course.notes.length === 0 && <p className="text-sm text-lipro-600/60">No notes yet.</p>}
            </div>
            <div className="mt-4"><NoteEditor courseId={course.id} /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Question bank ({course.questions.length})</CardTitle><CardDescription>{canManage ? 'Add and manage CBT questions' : 'Available questions'}</CardDescription></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {course.questions.map((q) => (
                <div key={q.id} className="rounded-xl p-3 glass-hover">
                  <div className="flex items-center justify-between"><Badge tone="amber">{q.type}</Badge><span className="text-xs text-lipro-600/60">{q.points} pts</span></div>
                  <div className="mt-1 text-sm">{q.question}</div>
                </div>
              ))}
              {course.questions.length === 0 && <p className="text-sm text-lipro-600/60">No questions yet.</p>}
            </div>
            {canManage && <div className="mt-4"><QuestionManager courseId={course.id} /></div>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
