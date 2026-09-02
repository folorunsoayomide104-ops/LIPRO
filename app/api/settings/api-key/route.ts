import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/api-guard';
import { maskApiKey } from '@/lib/ai';

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
