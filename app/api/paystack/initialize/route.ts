import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/api-guard';

const PLANS = {
  premium: { amount: 1700, tier: 'PREMIUM', label: 'Premium ₦1,700/mo' },
  ultimate: { amount: 3000, tier: 'ULTIMATE', label: 'Ultimate ₦3,000/mo' },
} as const;

export async function POST(req: Request) {
  const { ok, user, response } = await guard();
  if (!ok || !user) return response!;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  const { plan } = body as { plan: keyof typeof PLANS };
  if (!PLANS[plan]) return NextResponse.json({ error: 'Unknown plan' }, { status: 422 });

  const planDef = PLANS[plan];
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret || secret.startsWith('sk_test_xxxx')) {
    // Dev/demo mode: upgrade tier immediately without hitting Paystack
    const expiry = new Date();
    expiry.setMonth(expiry.getMonth() + 1);
    await prisma.user.update({
      where: { id: user.userId },
      data: { subscriptionTier: planDef.tier, subscriptionExpiry: expiry },
    });
    await prisma.walletTxn.create({
      data: { userId: user.userId, type: 'DEBIT', amount: planDef.amount, reference: `SUB_${Date.now()}`, status: 'completed' },
    });
    return NextResponse.json({ ok: true, demo: true, tier: planDef.tier });
  }

  const u = await prisma.user.findUnique({ where: { id: user.userId } });
  if (!u) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const res = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
    body: JSON.stringify({
      email: u.email,
      amount: planDef.amount * 100,
      currency: 'NGN',
      callback_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/subscription?status=success`,
      metadata: { userId: user.userId, plan, tier: planDef.tier },
    }),
  });
  const data = await res.json();
  if (!data.status) return NextResponse.json({ error: data.message || 'Paystack init failed' }, { status: 502 });
  return NextResponse.json({ authorizationUrl: data.data.authorization_url, reference: data.data.reference });
}
