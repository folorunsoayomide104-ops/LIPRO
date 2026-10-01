import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/api-guard';
import { logAdminAudit } from '@/lib/admin/audit';

export async function POST(req: Request) {
  const { ok, user, response } = await guard('ADMIN');
  if (!ok || !user) return response!;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!title || !message) return NextResponse.json({ error: 'Title and message are required' }, { status: 422 });
  if (title.length > 200) return NextResponse.json({ error: 'Title is too long' }, { status: 422 });
  if (message.length > 5000) return NextResponse.json({ error: 'Message is too long' }, { status: 422 });

  const where: Record<string, unknown> = { role: 'STUDENT' };
  if (typeof body.faculty === 'string' && body.faculty) where.faculty = body.faculty;
  if (typeof body.department === 'string' && body.department) where.department = body.department;
  if (typeof body.level === 'string' && body.level) where.level = body.level;
  if (typeof body.semester === 'string' && body.semester) where.semester = body.semester;

  const students = await prisma.user.findMany({ where, select: { id: true } });
  if (students.length === 0) {
    return NextResponse.json({ error: 'No students match this audience' }, { status: 422 });
  }

  await prisma.notification.createMany({
    data: students.map((s) => ({ userId: s.id, type: 'ANNOUNCEMENT', title, message })),
  });

  await logAdminAudit({
    actorUserId: user.userId,
    actorEmail: user.email,
    action: 'announcement',
    detail: `Sent to ${students.length} students · "${title.slice(0, 80)}"`,
    broadcast: true,
  });

  return NextResponse.json({ ok: true, sentTo: students.length });
}
