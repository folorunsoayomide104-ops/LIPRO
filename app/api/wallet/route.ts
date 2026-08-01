import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/api-guard';

export async function GET() {
  const { ok, user, response } = await guard();
  if (!ok || !user) return response!;
  const u = await prisma.user.findUnique({ where: { id: user.userId }, select: { walletBalance: true } });
  const txns = await prisma.walletTxn.findMany({
    where: { userId: user.userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return NextResponse.json({
    balance: u?.walletBalance || 0,
    txns: txns.map((t) => ({ ...t, createdAt: t.createdAt.toISOString() })),
  });
}
