import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/api-guard';

export async function GET() {
  const { ok, response } = await guard('ADMIN');
  if (!ok) return response!;
  const users = await prisma.user.findMany({
    select: {
      id: true, email: true, fullName: true, matricNumber: true, university: true,
      faculty: true, department: true, level: true, semester: true, role: true,
      subscriptionTier: true, walletBalance: true, createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return NextResponse.json({
    users: users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() })),
  });
}
