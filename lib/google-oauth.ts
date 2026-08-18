const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

export function isGoogleOAuthConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function getGoogleRedirectUri(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://liproacademyapp.vercel.app';
  return `${base.replace(/\/$/, '')}/api/auth/google/callback`;
}

export function buildGoogleAuthUrl(state: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error('GOOGLE_CLIENT_ID is not configured');
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getGoogleRedirectUri(),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export interface GoogleProfile {
  googleId: string;
  email: string;
  fullName: string;
  emailVerified: boolean;
}

/** Exchanges an authorization code for the caller's Google profile. Returns
 *  null on any failure (network, bad code, missing credentials) rather than
 *  throwing — the callback route always has a safe "send them back to
 *  login" fallback for that case. */
export async function exchangeGoogleCode(code: string): Promise<GoogleProfile | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  try {
    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: getGoogleRedirectUri(),
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenRes.ok) return null;
    const tokenData = await tokenRes.json();
    const accessToken = tokenData?.access_token;
    if (typeof accessToken !== 'string') return null;

    const infoRes = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!infoRes.ok) return null;
    const info = await infoRes.json();
    if (typeof info?.sub !== 'string' || typeof info?.email !== 'string') return null;

    return {
      googleId: info.sub,
      email: info.email,
      fullName: typeof info.name === 'string' && info.name.trim() ? info.name : info.email.split('@')[0],
      emailVerified: !!info.email_verified,
    };
  } catch {
    return null;
  }
}
