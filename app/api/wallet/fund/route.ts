import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/api-guard';

export async function POST(req: Request) {
  const { ok, user, response } = await guard();
  if (!ok || !user) return response!;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  const amount = Number(body.amount);
  if (!amount || amount < 100) return NextResponse.json({ error: 'Minimum ₦100' }, { status: 422 });

  const secret = process.env.PAYSTACK_SECRET_KEY;
  const u = await prisma.user.findUnique({ where: { id: user.userId } });
  if (!u) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  if (!secret || secret.startsWith('sk_test_xxxx')) {
    // Demo: credit immediately
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.userId }, data: { walletBalance: { increment: amount } } }),
      prisma.walletTxn.create({ data: { userId: user.userId, type: 'CREDIT', amount, reference: `DEMO_FUND_${Date.now()}`, status: 'completed' } }),
    ]);
    return NextResponse.json({ ok: true, demo: true, balance: (u.walletBalance + amount) });
  }

  const res = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
    body: JSON.stringify({
      email: u.email,
      amount: amount * 100,
      currency: 'NGN',
      callback_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/wallet?status=funded`,
      metadata: { userId: user.userId, type: 'WALLET_FUND', amount },
    }),
  });
  const data = await res.json();
  if (!data.status) return NextResponse.json({ error: data.message || 'Paystack init failed' }, { status: 502 });
  return NextResponse.json({ authorizationUrl: data.data.authorization_url, reference: data.data.reference });
}
