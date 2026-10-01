import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getWeakTopics } from '@/lib/weak-topics';
import { getDueReviews } from '@/lib/cbt/spaced';
import { getStudyStreak } from '@/lib/cbt/streak';

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization') || '';
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const students = await prisma.user.findMany({
    where: { role: 'STUDENT' },
    select: { id: true, fullName: true },
    take: 500,
  });

  let sent = 0;
  for (const s of students) {
    const [weak, due, streak] = await Promise.all([
      getWeakTopics(s.id, 5),
      getDueReviews(s.id, 5),
      getStudyStreak(s.id),
    ]);
    const dueNow = due.filter((d) => d.isDue);
    if (weak.length === 0 && dueNow.length === 0 && streak === 0) continue;

    const parts: string[] = [];
    if (dueNow.length) {
      parts.push(
        `${dueNow.length} topic${dueNow.length === 1 ? '' : 's'} due for review: ${dueNow
          .slice(0, 3)
          .map((d) => d.label)
          .join(', ')}`,
      );
    }
    if (weak.length) {
      parts.push(
        `Weak areas: ${weak
          .slice(0, 3)
          .map((w) => `${w.label} (${w.accuracyPct}%)`)
          .join(', ')}`,
      );
    }
    if (streak > 0) parts.push(`Study streak: ${streak} day${streak === 1 ? '' : 's'}`);

    await prisma.notification.create({
      data: {
        userId: s.id,
        type: 'ACADEMIC',
        title: 'Your weekly study digest',
        message: parts.join(' · ').slice(0, 5000),
      },
    });
    sent += 1;
  }

  return NextResponse.json({ ok: true, students: students.length, sent });
}

export async function GET(req: Request) {
  return POST(req);
}
