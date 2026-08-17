import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/api-guard';
import { noteSchema } from '@/lib/validators';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ok, user, response } = await guard();
  if (!ok || !user) return response!;
  const { id } = await params;
  // findFirst scoped by userId, not findUnique by id alone — this was the
  // one Medium finding from the pre-launch audit left open (PATCH/DELETE on
  // this same file already check ownership; GET didn't, so any authenticated
  // user who knew/guessed a note id could read someone else's private note).
  const note = await prisma.note.findFirst({ where: { id, userId: user.userId }, include: { course: true } });
  if (!note) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ note });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ok, user, response } = await guard();
  if (!ok || !user) return response!;
  const { id } = await params;
  const existing = await prisma.note.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  const parsed = noteSchema.partial().safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 422 });
  const note = await prisma.note.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ note });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ok, user, response } = await guard();
  if (!ok || !user) return response!;
  const { id } = await params;
  const existing = await prisma.note.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (existing.userId !== user.userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await prisma.note.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
