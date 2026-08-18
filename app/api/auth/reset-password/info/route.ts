import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyResetToken } from '@/lib/auth';

/** Lets the reset-password page tell a real "invalid/expired link" apart
 *  from "valid link", and tailor its copy for accounts that don't have a
 *  password yet (Google-only sign-ins) versus ones that do. Safe to expose
 *  without rate limiting/enumeration concerns — the token itself already
 *  proves the caller received the reset email, i.e. owns the account. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get('token') || '';
  if (!token) return NextResponse.json({ valid: false });

  const userId = await verifyResetToken(token);
  if (!userId) return NextResponse.json({ valid: false });

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
  if (!user) return NextResponse.json({ valid: false });

  return NextResponse.json({ valid: true, hasPassword: !!user.passwordHash });
}
