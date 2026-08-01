import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/api-guard';

export async function GET() {
  const { ok, user, response } = await guard();
  if (!ok || !user) return response!;
  const conversations = await prisma.aiConversation.findMany({
    where: { userId: user.userId },
    select: { id: true, title: true, updatedAt: true, createdAt: true },
    orderBy: { updatedAt: 'desc' },
  });
  return NextResponse.json({ conversations: conversations.map((c) => ({ ...c, createdAt: c.createdAt.toISOString(), updatedAt: c.updatedAt.toISOString() })) });
}
