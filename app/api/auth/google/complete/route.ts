import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { signToken, setAuthCookie, GOOGLE_SIGNUP_COOKIE, verifyGooglePendingSignup } from '@/lib/auth';
import { googleCompleteSchema } from '@/lib/validators';

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const store = await cookies();
  // Web carries the pending-signup token via the httpOnly cookie set in
  // ../callback/route.ts; the Flutter app has no cookie jar shared with
  // this route, so it sends the identical signed token back explicitly in
  // the body instead (received from the callback's deep-link redirect).
  const pendingToken = store.get(GOOGLE_SIGNUP_COOKIE)?.value || (typeof body.pendingToken === 'string' ? body.pendingToken : undefined);
  if (!pendingToken) {
    return NextResponse.json({ error: 'Your Google sign-in expired. Please try again.' }, { status: 400 });
  }
  const pending = await verifyGooglePendingSignup(pendingToken);
  if (!pending) {
    return NextResponse.json({ error: 'Your Google sign-in expired. Please try again.' }, { status: 400 });
  }

  const parsed = googleCompleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid input' }, { status: 422 });
  }
  const d = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email: pending.email } });
  if (existing) return NextResponse.json({ error: 'Email already registered' }, { status: 409 });

  const user = await prisma.user.create({
    data: {
      email: pending.email,
      passwordHash: null,
      googleId: pending.googleId,
      fullName: d.fullName || pending.fullName,
      matricNumber: d.matricNumber,
      university: d.university,
      faculty: d.faculty,
      department: d.department,
      level: d.level,
      semester: d.semester,
      role: 'STUDENT',
      isEmailVerified: true, // Google already verified this address
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
  store.delete(GOOGLE_SIGNUP_COOKIE);

  // `token` included alongside the cookie for the Flutter app — same
  // pattern as /api/auth/login and /api/auth/register (see lib/api-guard.ts).
  return NextResponse.json({ ok: true, userId: user.id, token });
}
