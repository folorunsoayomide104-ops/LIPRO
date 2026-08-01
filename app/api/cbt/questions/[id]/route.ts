import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/api-guard';

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ok, user, response } = await guard();
  if (!ok || !user) return response!;
  const { id } = await params;
  const q = await prisma.question.findUnique({ where: { id } });
  if (!q) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (q.authorId !== user.userId && user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  await prisma.question.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
