import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { signResetToken, RESET_TOKEN_TTL_SECONDS } from '@/lib/auth';
import { sendPasswordResetEmail, APP_URL } from '@/lib/email';
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/rate-limit';

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';

  // Rate-limited before the user lookup, and for both a real and a
  // nonexistent email, so this can't be used to spam a victim's inbox
  // (or a stranger's, burning the Resend send quota) just by knowing or
  // guessing their address.
  const ip = getClientIp(req);
  const ipLimit = await checkRateLimit(`forgot-password:ip:${ip}`, 60 * 60 * 1000, 6);
  if (!ipLimit.ok) return rateLimitResponse(ipLimit);
  if (email) {
    const emailLimit = await checkRateLimit(`forgot-password:email:${email}`, 60 * 60 * 1000, 4);
    if (!emailLimit.ok) return rateLimitResponse(emailLimit);
  }

  const user = email ? await prisma.user.findUnique({ where: { email } }) : null;

  if (!user) {
    return NextResponse.json({ ok: true });
  }

  const token = await signResetToken(user.id);
  const resetUrl = `${APP_URL}/reset-password?token=${encodeURIComponent(token)}`;

  try {
    await sendPasswordResetEmail(user.email, resetUrl);
  } catch (err) {
    console.error('Failed to send password reset email:', err);
    return NextResponse.json({ error: 'Failed to send reset email. Please try again.' }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    message: `Reset link sent. It expires in ${RESET_TOKEN_TTL_SECONDS / 60} minutes.`,
  });
}
