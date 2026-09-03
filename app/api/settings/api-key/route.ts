import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/api-guard';
import { maskApiKey } from '@/lib/ai';

// The web Settings page gets hasKey/masked for free by reading nvidiaApiKey
// directly via server-side Prisma in the page component itself — there was
// never a GET route because nothing needed one. The Flutter app has no such
// server-side render step, so it needs an actual endpoint to know on load
// whether a key is already set, without ever exposing the raw key value.
export async function GET() {
  const { ok, user, response } = await guard();
  if (!ok || !user) return response!;
  const u = await prisma.user.findUnique({ where: { id: user.userId }, select: { nvidiaApiKey: true } });
  const key = u?.nvidiaApiKey?.trim();
  return NextResponse.json({ hasKey: !!key, masked: key ? maskApiKey(key) : null });
}

export async function POST(req: Request) {
  const { ok, user, response } = await guard();
  if (!ok || !user) return response!;

  const body = await req.json().catch(() => null);
  const action = body?.action;
  const apiKey = typeof body?.apiKey === 'string' ? body.apiKey.trim() : '';

  if (action === 'clear' || apiKey === '') {
    await prisma.user.update({ where: { id: user.userId }, data: { nvidiaApiKey: null } });
    return NextResponse.json({ hasKey: false });
  }

  if (apiKey.length < 8) {
    return NextResponse.json({ error: 'API key looks too short.' }, { status: 422 });
  }
  if (!/^[A-Za-z0-9\-_.]+$/.test(apiKey)) {
    return NextResponse.json({ error: 'Invalid characters in API key.' }, { status: 422 });
  }

  await prisma.user.update({ where: { id: user.userId }, data: { nvidiaApiKey: apiKey } });
  return NextResponse.json({ hasKey: true, masked: maskApiKey(apiKey) });
}
