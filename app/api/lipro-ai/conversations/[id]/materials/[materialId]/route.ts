import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/api-guard';

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; materialId: string }> }) {
  const { ok, user, response } = await guard();
  if (!ok || !user) return response!;
  const { id, materialId } = await params;

  const conv = await prisma.aiConversation.findFirst({ where: { id, userId: user.userId }, select: { id: true } });
  if (!conv) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });

  await prisma.aiConversationMaterial.deleteMany({ where: { conversationId: id, materialId } });
  return NextResponse.json({ ok: true });
}
