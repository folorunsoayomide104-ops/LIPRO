import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/api-guard';

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ok, user, response } = await guard();
  if (!ok || !user) return response!;
  const { id } = await params;

  const material = await prisma.material.findUnique({ where: { id } });
  if (!material) return NextResponse.json({ error: 'Material not found' }, { status: 404 });
  if (material.userId !== user.userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await prisma.question.deleteMany({ where: { sourceId: id } });
  await prisma.material.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
