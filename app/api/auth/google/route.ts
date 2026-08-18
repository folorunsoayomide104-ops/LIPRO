import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { buildGoogleAuthUrl, isGoogleOAuthConfigured } from '@/lib/google-oauth';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://liproacademyapp.vercel.app';

export async function GET() {
  if (!isGoogleOAuthConfigured()) {
    return NextResponse.redirect(`${APP_URL.replace(/\/$/, '')}/login?error=google_not_configured`);
  }

  const state = `login.${crypto.randomBytes(24).toString('hex')}`;
  const res = NextResponse.redirect(buildGoogleAuthUrl(state));
  // sameSite: 'lax' (not 'none') — this cookie only needs to survive the
  // top-level redirect back from Google, which 'lax' already allows, and
  // 'lax' is the safer default for a value with no legitimate cross-site read.
  res.cookies.set('google_oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });
  return res;
}
