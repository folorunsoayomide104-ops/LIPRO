import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { signToken, setAuthCookie, signResetToken, signGooglePendingSignup, GOOGLE_SIGNUP_COOKIE, GOOGLE_SIGNUP_TTL_SECONDS } from '@/lib/auth';
import { exchangeGoogleCode } from '@/lib/google-oauth';

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://liproacademyapp.vercel.app').replace(/\/$/, '');

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  const store = await cookies();
  const expectedState = store.get('google_oauth_state')?.value;
  store.delete('google_oauth_state');

  // Encoded by the two start routes (/api/auth/google vs /api/auth/google/reset)
  // as a prefix on the state value itself, so the shared callback can tell a
  // password-reset request apart from a normal login/signup without a second
  // cookie. Comparing the full prefixed value against the cookie (not just
  // the random suffix) still gives us the same CSRF protection either way.
  const isResetIntent = state?.startsWith('reset.') ?? false;
  const errorTarget = isResetIntent ? 'forgot-password' : 'login';

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(`${APP_URL}/${errorTarget}?error=google_state`);
  }

  const profile = await exchangeGoogleCode(code);
  if (!profile) {
    return NextResponse.redirect(`${APP_URL}/${errorTarget}?error=google_failed`);
  }

  // 1. Already linked to a LIPRO account.
  let user = await prisma.user.findUnique({ where: { googleId: profile.googleId } });

  // 2. An account exists under this email (registered with a password) but
  //    isn't linked yet — link it now so future Google sign-ins work too.
  if (!user) {
    const byEmail = await prisma.user.findUnique({ where: { email: profile.email } });
    if (byEmail) {
      user = await prisma.user.update({ where: { id: byEmail.id }, data: { googleId: profile.googleId } });
    }
  }

  if (isResetIntent) {
    // Google having just verified this person owns that email is exactly
    // the same proof-of-ownership a clicked email link would have given —
    // so this reuses the real password-reset token mechanism rather than
    // inventing a separate "reset via Google" code path.
    if (!user) {
      return NextResponse.redirect(`${APP_URL}/forgot-password?error=no_account`);
    }
    const resetToken = await signResetToken(user.id);
    return NextResponse.redirect(`${APP_URL}/reset-password?token=${encodeURIComponent(resetToken)}`);
  }

  if (user) {
    const token = await signToken({ userId: user.id, email: user.email, role: user.role as any });
    await setAuthCookie(token);
    return NextResponse.redirect(`${APP_URL}/dashboard`);
  }

  // 3. Brand-new user. This app's registration requires university/matric
  //    fields Google can't supply, so we can't create the account yet —
  //    hand the Google-verified identity to the register page via a
  //    short-lived signed cookie and let them finish the required fields.
  const pendingToken = await signGooglePendingSignup({
    email: profile.email,
    googleId: profile.googleId,
    fullName: profile.fullName,
  });
  const res = NextResponse.redirect(`${APP_URL}/register?google=1`);
  res.cookies.set(GOOGLE_SIGNUP_COOKIE, pendingToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: GOOGLE_SIGNUP_TTL_SECONDS,
    path: '/',
  });
  return res;
}
