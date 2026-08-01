import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/api-guard';
import { noteSchema } from '@/lib/validators';

export async function GET(req: Request) {
  const { ok, user, response } = await guard();
  if (!ok || !user) return response!;
  const url = new URL(req.url);
  const courseId = url.searchParams.get('courseId');
  const notes = await prisma.note.findMany({
    where: {
      OR: [
        { userId: user.userId },
        { course: { lecturerId: user.userId } },
      ],
      ...(courseId ? { courseId } : {}),
    },
    include: { course: { select: { code: true, title: true } } },
    orderBy: { updatedAt: 'desc' },
  });
  return NextResponse.json({ notes });
}

export async function POST(req: Request) {
  const { ok, user, response } = await guard();
  if (!ok || !user) return response!;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  const parsed = noteSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 422 });
  const note = await prisma.note.create({
    data: { ...parsed.data as any, userId: user.userId },
  });
  return NextResponse.json({ note }, { status: 201 });
}
