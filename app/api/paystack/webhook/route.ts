import { NextResponse, NextRequest } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  const raw = await req.text();
  const body = raw ? JSON.parse(raw) : {};

  if (secret && !secret.startsWith('sk_test_xxxx')) {
    const signature = req.headers.get('x-paystack-signature');
    if (!signature) return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
    const expected = createHmac('sha512', secret).update(raw).digest('hex');
    const a = Buffer.from(signature, 'hex');
    const b = Buffer.from(expected, 'hex');
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
  }

  const event = body?.event;
  if (event !== 'charge.success') return NextResponse.json({ ok: true });

  const metadata = body?.data?.metadata;
  if (!metadata?.userId || !metadata?.tier) return NextResponse.json({ ok: true });

  const ref = body?.data?.reference;
  const amount = (body?.data?.amount || 0) / 100;
  const expiry = new Date();
  expiry.setMonth(expiry.getMonth() + 1);

  await prisma.user.update({
    where: { id: metadata.userId },
    data: { subscriptionTier: metadata.tier, subscriptionExpiry: expiry, paystackCustomerId: body?.data?.customer?.customer_code || null },
  });
  await prisma.walletTxn.create({
    data: { userId: metadata.userId, type: 'DEBIT', amount, reference: ref, status: 'completed' },
  });
  await prisma.notification.create({
    data: { userId: metadata.userId, type: 'PAYMENT', title: 'Subscription activated', message: `Your ${metadata.tier} subscription is now active.` },
  });

  return NextResponse.json({ ok: true });
}
