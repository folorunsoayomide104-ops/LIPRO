import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { signToken, setAuthCookie, clearAuthCookie } from '@/lib/auth';
import { loginSchema } from '@/lib/validators';
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/rate-limit';

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid input' }, { status: 422 });
  }
  const { email, password, remember } = parsed.data;

  // Two independent limits: per-IP stops a single attacker guessing across
  // many accounts, per-email stops the same account being brute-forced from
  // many different IPs (distributed credential stuffing against one target).
  const ip = getClientIp(req);
  const ipLimit = await checkRateLimit(`login:ip:${ip}`, 15 * 60 * 1000, 20);
  if (!ipLimit.ok) return rateLimitResponse(ipLimit);
  const emailLimit = await checkRateLimit(`login:email:${email}`, 15 * 60 * 1000, 8);
  if (!emailLimit.ok) return rateLimitResponse(emailLimit);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
  if (!user.passwordHash) {
    return NextResponse.json({ error: 'This account uses Google Sign-In. Continue with Google below, or use "Forgot password?" to set one.' }, { status: 401 });
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });

  const token = await signToken({ userId: user.id, email: user.email, role: user.role as any }, { remember });
  await setAuthCookie(token, { remember });
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  return NextResponse.json({ ok: true, role: user.role });
}

export async function DELETE() {
  await clearAuthCookie();
  return NextResponse.json({ ok: true });
}
