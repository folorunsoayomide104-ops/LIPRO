import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/api-guard';

const ALLOWED = ['fullName', 'matricNumber', 'university', 'faculty', 'department', 'level', 'semester', 'avatarUrl'];

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ok, user, response } = await guard();
  if (!ok || !user) return response!;
  const { id } = await params;
  if (id !== user.userId && user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  const update: any = {};
  for (const key of ALLOWED) {
    if (key in body && typeof body[key] === 'string') update[key] = body[key];
  }
  if (Object.keys(update).length === 0) return NextResponse.json({ error: 'No allowed fields' }, { status: 422 });
  const u = await prisma.user.update({ where: { id }, data: update, select: { id: true, fullName: true } });
  return NextResponse.json({ user: u });
}