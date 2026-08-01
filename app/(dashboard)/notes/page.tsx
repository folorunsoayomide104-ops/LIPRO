import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

export default async function NotesPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const notes = await prisma.note.findMany({
    where: { userId: session.userId },
    include: { course: { select: { id: true, code: true, title: true } } },
    orderBy: { updatedAt: 'desc' },
  });
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold tracking-tight">My Notes</h1><p className="text-sm text-lipro-600/70 dark:text-lipro-200/70">Your personal study notes</p></div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {notes.length === 0 && <p className="text-sm text-lipro-600/60">No notes yet. Create one from a course page.</p>}
        {notes.map((n) => (
          <Link key={n.id} href={`/courses/${n.course?.id || ''}`}>
            <Card className="h-full">
              <CardHeader><Badge tone="purple">{n.course?.code || 'General'}</Badge><CardTitle className="mt-2 text-base">{n.title}</CardTitle><CardDescription>Last updated {new Date(n.updatedAt).toLocaleDateString()}</CardDescription></CardHeader>
              <CardContent><p className="text-xs text-lipro-700/70 dark:text-lipro-200/70 line-clamp-3">{n.content}</p></CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}