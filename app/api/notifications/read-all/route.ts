import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/api-guard';

export async function POST() {
  const { ok, user, response } = await guard();
  if (!ok || !user) return response!;

  await prisma.notification.updateMany({
    where: { userId: user.userId, isRead: false },
    data: { isRead: true },
  });

  return NextResponse.json({ ok: true });
}
