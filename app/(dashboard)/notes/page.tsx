import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { NotesClient } from '@/components/dashboard/notes-client';

export default async function NotesPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const [notes, materials, courses] = await Promise.all([
    prisma.note.findMany({
      where: { userId: session.userId },
      include: { course: { select: { id: true, code: true, title: true } } },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.material.findMany({
      where: { userId: session.userId, text: { not: null } },
      select: { id: true, originalName: true, courseId: true },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
    prisma.course.findMany({
      select: { id: true, code: true, title: true },
      orderBy: { code: 'asc' },
      take: 200,
    }),
  ]);

  return (
    <NotesClient
      initialNotes={notes.map((n) => ({
        id: n.id,
        title: n.title,
        content: n.content,
        tags: n.tags,
        courseId: n.course?.id ?? null,
        courseCode: n.course?.code ?? null,
        updatedAt: n.updatedAt.toISOString(),
      }))}
      materials={materials.map((m) => ({ id: m.id, name: m.originalName, courseId: m.courseId }))}
      courses={courses}
    />
  );
}
