import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { GRADE_STUCK_MS } from '@/lib/cbt/constants';
import { runGrading } from '@/lib/cbt/grade-runner';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const MAX_PER_RUN = 5;

/**
 * Safety net for AI grading: the client normally triggers POST .../grade right
 * after submitting, but a closed tab or a crashed function can leave an attempt
 * stuck. This sweeps anything still pending after GRADE_STUCK_MS.
 *
 * Scheduled from vercel.json and protected by CRON_SECRET.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 503 });
  }
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - GRADE_STUCK_MS);
  const stuck = await prisma.examSession.findMany({
    where: {
      status: 'completed',
      gradingStatus: { in: ['pending', 'grading', 'failed'] },
      completedAt: { lt: cutoff },
    },
    orderBy: { completedAt: 'asc' },
    take: MAX_PER_RUN,
    select: { id: true },
  });

  const results = [];
  for (const { id } of stuck) {
    // A stalled 'grading' claim must be released before runGrading will take it.
    await prisma.examSession.updateMany({
      where: { id, gradingStatus: 'grading' },
      data: { gradingStatus: 'pending' },
    });
    const outcome = await runGrading(id);
    results.push({ attemptId: id, gradingStatus: outcome?.gradingStatus ?? 'unknown' });
  }

  return NextResponse.json({ swept: results.length, results });
}
