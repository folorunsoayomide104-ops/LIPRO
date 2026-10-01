import { prisma } from '@/lib/prisma';

/**
 * Count consecutive calendar days (ending today or yesterday) with at least
 * one completed CBT attempt. Pure read on examSession — no new tables.
 */
export async function getStudyStreak(userId: string): Promise<number> {
  const rows = await prisma.examSession.findMany({
    where: { userId, status: 'completed' },
    select: { startedAt: true, completedAt: true },
    orderBy: { startedAt: 'desc' },
    take: 120,
  });

  if (rows.length === 0) return 0;

  const days = new Set<string>();
  for (const r of rows) {
    const d = r.completedAt || r.startedAt;
    days.add(new Date(d).toISOString().slice(0, 10));
  }

  const sorted = [...days].sort().reverse();
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  if (sorted[0] !== today && sorted[0] !== yesterday) return 0;

  let streak = 0;
  let cursor = new Date(sorted[0] + 'T12:00:00Z');
  for (const key of sorted) {
    const expect = cursor.toISOString().slice(0, 10);
    if (key !== expect) break;
    streak += 1;
    cursor = new Date(cursor.getTime() - 86400000);
  }
  return streak;
}
