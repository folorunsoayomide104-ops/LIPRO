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
  // as a `<intent>.<platform>.<random>` prefix on the state value itself, so
  // the shared callback can tell a password-reset request apart from a
  // normal login/signup, and a mobile caller apart from the browser,
  // without a second cookie. Comparing the full prefixed value against the
  // cookie (not just the random suffix) still gives us the same CSRF
  // protection either way.
  const isResetIntent = state?.startsWith('reset.') ?? false;
  const isMobile = state?.includes('.mobile.') ?? false;
  const errorTarget = isResetIntent ? 'forgot-password' : 'login';
  // The Flutter app (flutter_web_auth_2) watches for a redirect to this
  // custom scheme to know the OAuth flow finished — see google_auth_service.dart
  // in the mobile repo. Every mobile branch below redirects here instead of
  // setting a cookie, since a WebView/Custom-Tab session's cookies aren't
  // visible to the app's own HTTP client the way a browser's are.
  const MOBILE_SCHEME = 'liproacademy://auth';

  const errorRedirect = (error: string) =>
    isMobile
      ? NextResponse.redirect(`${MOBILE_SCHEME}?error=${error}`)
      : NextResponse.redirect(`${APP_URL}/${errorTarget}?error=${error}`);

  if (!code || !state || !expectedState || state !== expectedState) {
    return errorRedirect('google_state');
  }

  const profile = await exchangeGoogleCode(code);
  if (!profile) {
    return errorRedirect('google_failed');
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
      return isMobile
        ? NextResponse.redirect(`${MOBILE_SCHEME}?error=no_account`)
        : NextResponse.redirect(`${APP_URL}/forgot-password?error=no_account`);
    }
    const resetToken = await signResetToken(user.id);
    return isMobile
      ? NextResponse.redirect(`${MOBILE_SCHEME}?resetToken=${encodeURIComponent(resetToken)}`)
      : NextResponse.redirect(`${APP_URL}/reset-password?token=${encodeURIComponent(resetToken)}`);
  }

  if (user) {
    const token = await signToken({ userId: user.id, email: user.email, role: user.role as any });
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    if (isMobile) {
      // Bearer token in the deep-link URL, not a cookie — a WebView/Custom-Tab
      // session's cookies aren't visible to the app's own HTTP client. See
      // lib/api-guard.ts for the same Bearer-token path email/password login
      // already uses for mobile.
      return NextResponse.redirect(`${MOBILE_SCHEME}?token=${encodeURIComponent(token)}`);
    }
    await setAuthCookie(token);
    return NextResponse.redirect(`${APP_URL}/dashboard`);
  }

  // 3. Brand-new user. This app's registration requires university/matric
  //    fields Google can't supply, so we can't create the account yet —
  //    hand the Google-verified identity to the register page. Web carries
  //    it via a short-lived signed cookie (unreadable by the mobile app's
  //    own HTTP client, same reasoning as above); mobile gets the identical
  //    signed token directly in the deep-link URL instead, and the app
  //    sends it back explicitly in the body of its own completion request —
  //    see the `pendingToken` body fallback in ../complete/route.ts.
  const pendingToken = await signGooglePendingSignup({
    email: profile.email,
    googleId: profile.googleId,
    fullName: profile.fullName,
  });
  if (isMobile) {
    return NextResponse.redirect(
      `${MOBILE_SCHEME}?pendingToken=${encodeURIComponent(pendingToken)}&email=${encodeURIComponent(profile.email)}&fullName=${encodeURIComponent(profile.fullName)}`
    );
  }
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
