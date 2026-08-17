import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/api-guard';
import { courseUpdateSchema } from '@/lib/validators';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ok, response } = await guard();
  if (!ok) return response!;
  const { id } = await params;
  const course = await prisma.course.findUnique({
    where: { id },
    include: {
      lecturer: { select: { fullName: true } },
      notes: { orderBy: { updatedAt: 'desc' }, take: 20 },
      _count: { select: { notes: true, questions: true } },
    },
  });
  if (!course) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ course });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ok, user, response } = await guard('LECTURER');
  if (!ok || !user) return response!;
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  const parsed = courseUpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid input' }, { status: 422 });
  const course = await prisma.course.findUnique({ where: { id } });
  if (!course || course.lecturerId !== user.userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const updated = await prisma.course.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ course: updated });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ok, user, response } = await guard();
  if (!ok || !user) return response!;
  const { id } = await params;
  const course = await prisma.course.findUnique({ where: { id } });
  if (!course) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (course.lecturerId !== user.userId && user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  await prisma.course.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
