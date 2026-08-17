import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/api-guard';
import { flashcardUpdateSchema } from '@/lib/validators';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ok, user, response } = await guard();
  if (!ok || !user) return response!;
  const { id } = await params;
  const card = await prisma.flashcard.findFirst({
    where: { id, userId: user.userId },
    include: { course: { select: { code: true, title: true } }, material: { select: { originalName: true } } },
  });
  if (!card) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ card });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ok, user, response } = await guard();
  if (!ok || !user) return response!;
  const { id } = await params;
  const existing = await prisma.flashcard.findFirst({ where: { id, userId: user.userId } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  const parsed = flashcardUpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 422 });
  const card = await prisma.flashcard.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ card });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ok, user, response } = await guard();
  if (!ok || !user) return response!;
  const { id } = await params;
  const existing = await prisma.flashcard.findFirst({ where: { id, userId: user.userId } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  await prisma.flashcard.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
