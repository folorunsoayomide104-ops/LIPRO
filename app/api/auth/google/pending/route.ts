import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { GOOGLE_SIGNUP_COOKIE, verifyGooglePendingSignup } from '@/lib/auth';

export async function GET() {
  const store = await cookies();
  const token = store.get(GOOGLE_SIGNUP_COOKIE)?.value;
  if (!token) return NextResponse.json({ pending: null });

  const data = await verifyGooglePendingSignup(token);
  if (!data) return NextResponse.json({ pending: null });

  return NextResponse.json({ pending: { email: data.email, fullName: data.fullName } });
}
