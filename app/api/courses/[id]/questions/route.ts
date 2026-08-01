import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/api-guard';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ok, response } = await guard();
  if (!ok) return response!;
  const { id } = await params;
  const questions = await prisma.question.findMany({
    where: { courseId: id },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ questions });
}
