import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/api-guard';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ok, user, response } = await guard();
  if (!ok || !user) return response!;
  const { id } = await params;

  const conv = await prisma.aiConversation.findFirst({
    where: { id, userId: user.userId },
    include: { materials: { include: { material: { select: { id: true, originalName: true } } } } },
  });
  if (!conv) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });

  const messages = JSON.parse(conv.messages);
  const materials = (conv.materials ?? []).map((m) => ({ id: m.material.id, name: m.material.originalName }));
  return NextResponse.json({ id: conv.id, title: conv.title, messages, materials, updatedAt: conv.updatedAt.toISOString() });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ok, user, response } = await guard();
  if (!ok || !user) return response!;
  const { id } = await params;

  const conv = await prisma.aiConversation.findFirst({ where: { id, userId: user.userId } });
  if (!conv) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });

  await prisma.aiConversation.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
