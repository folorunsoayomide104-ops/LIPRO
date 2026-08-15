import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/api-guard';
import { runGrading } from '@/lib/cbt/grade-runner';
import { percentage } from '@/lib/cbt/serialize';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

/**
 * Grade the attempt's written answers with AI.
 *
 * Split out from submit because Vercel has no reliable post-response background
 * work: the client fires this immediately after submitting and polls the results
 * endpoint. A cron sweep catches attempts whose client went away mid-grade.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ok, user, response } = await guard();
  if (!ok || !user) return response!;
  const { id } = await params;

  const owned = await prisma.examSession.findFirst({
    where: { id, userId: user.userId },
    select: { id: true },
  });
  if (!owned) return NextResponse.json({ error: 'Attempt not found' }, { status: 404 });

  const outcome = await runGrading(id);
  if (!outcome) return NextResponse.json({ error: 'Attempt not found' }, { status: 404 });

  return NextResponse.json({
    ...outcome,
    percentage: percentage(outcome.score, outcome.totalPoints),
  });
}
