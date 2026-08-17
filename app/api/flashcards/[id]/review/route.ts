import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/api-guard';
import { flashcardReviewSchema } from '@/lib/validators';

/** Records a study-session result ("I knew this" / "I didn't") for a card —
 *  separate from PATCH so editing card content and reviewing it stay distinct
 *  actions with distinct semantics, not overloaded onto one endpoint. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ok, user, response } = await guard();
  if (!ok || !user) return response!;
  const { id } = await params;
  const existing = await prisma.flashcard.findFirst({ where: { id, userId: user.userId } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  const parsed = flashcardReviewSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 422 });

  const card = await prisma.flashcard.update({
    where: { id },
    data: {
      timesSeen: { increment: 1 },
      timesCorrect: parsed.data.correct ? { increment: 1 } : undefined,
      lastReviewedAt: new Date(),
    },
  });
  return NextResponse.json({ card });
}
