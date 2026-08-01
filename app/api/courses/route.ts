import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/api-guard';
import { courseSchema } from '@/lib/validators';

export async function GET(req: Request) {
  const { ok, response } = await guard();
  if (!ok) return response!;
  const url = new URL(req.url);
  const faculty = url.searchParams.get('faculty');
  const department = url.searchParams.get('department');
  const level = url.searchParams.get('level');

  const courses = await prisma.course.findMany({
    where: {
      ...(faculty ? { faculty } : {}),
      ...(department ? { department } : {}),
      ...(level ? { level } : {}),
    },
    include: { _count: { select: { notes: true, questions: true } }, lecturer: { select: { fullName: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ courses });
}

export async function POST(req: Request) {
  const { ok, user, response } = await guard('LECTURER');
  if (!ok || !user) return response!;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  const parsed = courseSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 422 });
  const d = parsed.data;
  const course = await prisma.course.create({
    data: { ...d as any, lecturerId: user.userId },
  });
  return NextResponse.json({ course }, { status: 201 });
}
