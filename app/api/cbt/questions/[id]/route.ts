import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/api-guard';
import { canAccess } from '@/lib/auth';
import { questionUpdateSchema } from '@/lib/validators';

async function canManage(userId: string, role: string, q: { authorId: string; sourceId: string | null }): Promise<boolean> {
  if (q.authorId === userId) return true;
  if (canAccess('ADMIN', role as any)) return true;
  if (q.sourceId) {
    const material = await prisma.material.findUnique({ where: { id: q.sourceId }, select: { userId: true } });
    if (material?.userId === userId) return true;
  }
  return false;
}

/** Questions were previously uneditable once created. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ok, user, response } = await guard();
  if (!ok || !user) return response!;
  const { id } = await params;

  const q = await prisma.question.findUnique({ where: { id } });
  if (!q) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!(await canManage(user.userId, user.role, q))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  const parsed = questionUpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 422 });

  const updated = await prisma.question.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ question: updated });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ok, user, response } = await guard();
  if (!ok || !user) return response!;
  const { id } = await params;
  const q = await prisma.question.findUnique({ where: { id } });
  if (!q) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!(await canManage(user.userId, user.role, q))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  await prisma.question.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
