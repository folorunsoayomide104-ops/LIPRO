import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/api-guard';
import { questionSchema } from '@/lib/validators';

export async function GET(req: Request) {
  const { ok, response } = await guard();
  if (!ok) return response!;
  const url = new URL(req.url);
  const courseId = url.searchParams.get('courseId');
  const type = url.searchParams.get('type');
  const questions = await prisma.question.findMany({
    where: {
      ...(courseId ? { courseId } : {}),
      ...(type ? { type: type as any } : {}),
    },
    include: { course: { select: { code: true, title: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ questions });
}

export async function POST(req: Request) {
  const { ok, user, response } = await guard('LECTURER');
  if (!ok || !user) return response!;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  const parsed = questionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 422 });
  const q = await prisma.question.create({
    data: { ...parsed.data as any, authorId: user.userId },
  });
  return NextResponse.json({ question: q }, { status: 201 });
}
