import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/api-guard';

export async function GET() {
  const { ok, user, response } = await guard();
  if (!ok || !user) return response!;
  const u = await prisma.user.findUnique({
    where: { id: user.userId },
    select: {
      id: true, email: true, fullName: true, matricNumber: true, university: true,
      faculty: true, department: true, level: true, semester: true, role: true,
      avatarUrl: true, subscriptionTier: true, walletBalance: true, createdAt: true,
    },
  });
  if (!u) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  return NextResponse.json({ user: { ...u, createdAt: u.createdAt.toISOString() } });
}
