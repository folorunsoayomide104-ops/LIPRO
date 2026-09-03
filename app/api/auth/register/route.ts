import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { signToken, setAuthCookie } from '@/lib/auth';
import { registerSchema } from '@/lib/validators';
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/rate-limit';

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const ipLimit = await checkRateLimit(`register:ip:${ip}`, 60 * 60 * 1000, 8);
  if (!ipLimit.ok) return rateLimitResponse(ipLimit);

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid input' }, { status: 422 });
  }
  const d = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email: d.email } });
  if (existing) return NextResponse.json({ error: 'Email already registered' }, { status: 409 });

  const passwordHash = await bcrypt.hash(d.password, 10);
  const user = await prisma.user.create({
    data: {
      email: d.email,
      passwordHash,
      fullName: d.fullName,
      matricNumber: d.matricNumber,
      university: d.university,
      faculty: d.faculty,
      department: d.department,
      level: d.level,
      semester: d.semester,
      role: 'STUDENT',
      lastLoginAt: new Date(),
    },
  });

  await prisma.notification.create({
    data: {
      userId: user.id,
      type: 'INFO',
      title: 'Welcome to LIPRO Academy',
      message: `Hi ${user.fullName.split(' ')[0]}, your account is ready. Start by exploring courses or chatting with LIPRO AI.`,
    },
  });

  const token = await signToken({ userId: user.id, email: user.email, role: user.role as any });
  await setAuthCookie(token);

  return NextResponse.json({ ok: true, userId: user.id, token });
}
