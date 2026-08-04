import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { signResetToken, RESET_TOKEN_TTL_SECONDS } from '@/lib/auth';
import { sendPasswordResetEmail, APP_URL } from '@/lib/email';

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';

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
