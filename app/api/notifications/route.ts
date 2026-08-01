import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/api-guard';

export async function GET() {
  const { ok, user, response } = await guard();
  if (!ok || !user) return response!;
  const notifications = await prisma.notification.findMany({
    where: { userId: user.userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return NextResponse.json({
    notifications: notifications.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() })),
  });
}

export async function PATCH(req: Request) {
  const { ok, user, response } = await guard();
  if (!ok || !user) return response!;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  const { id } = body as { id: string };
  await prisma.notification.updateMany({ where: { id, userId: user.userId }, data: { isRead: true } });
  return NextResponse.json({ ok: true });
}
