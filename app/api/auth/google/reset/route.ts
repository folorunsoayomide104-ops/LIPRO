import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { buildGoogleAuthUrl, isGoogleOAuthConfigured } from '@/lib/google-oauth';

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://liproacademyapp.vercel.app').replace(/\/$/, '');

// Same OAuth dance as /api/auth/google, but the "reset." state prefix tells
// the shared callback this is a password-reset request, not a login: on
// success it should hand back a normal password-reset token instead of
// signing the browser in — see app/api/auth/google/callback/route.ts.
export async function GET() {
  if (!isGoogleOAuthConfigured()) {
    return NextResponse.redirect(`${APP_URL}/forgot-password?error=google_not_configured`);
  }

  const state = `reset.${crypto.randomBytes(24).toString('hex')}`;
  const res = NextResponse.redirect(buildGoogleAuthUrl(state));
  res.cookies.set('google_oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });
  return res;
}
