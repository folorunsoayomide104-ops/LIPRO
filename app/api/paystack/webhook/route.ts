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
  if (!metadata?.userId) return NextResponse.json({ ok: true });

  const ref = body?.data?.reference;
  const amount = (body?.data?.amount || 0) / 100;
  if (!ref) return NextResponse.json({ ok: true });

  // Idempotency fast-path: Paystack retries undelivered webhooks and can
  // legitimately fire the same event more than once. WalletTxn.reference is
  // now @unique, which is the real guarantee against a race between two
  // near-simultaneous deliveries (caught below); this check just avoids
  // doing the work twice in the common non-racing case.
  const already = await prisma.walletTxn.findUnique({ where: { reference: ref } });
  if (already) return NextResponse.json({ ok: true });

  try {
    if (metadata.type === 'WALLET_FUND') {
      await prisma.$transaction([
        prisma.user.update({ where: { id: metadata.userId }, data: { walletBalance: { increment: amount } } }),
        prisma.walletTxn.create({
          data: { userId: metadata.userId, type: 'CREDIT', amount, reference: ref, status: 'completed' },
        }),
        prisma.notification.create({
          data: { userId: metadata.userId, type: 'PAYMENT', title: 'Wallet funded', message: `₦${amount.toLocaleString()} was added to your wallet.` },
        }),
      ]);
    } else if (metadata.tier) {
      const expiry = new Date();
      expiry.setMonth(expiry.getMonth() + 1);
      await prisma.$transaction([
        prisma.user.update({
          where: { id: metadata.userId },
          data: { subscriptionTier: metadata.tier, subscriptionExpiry: expiry, paystackCustomerId: body?.data?.customer?.customer_code || null },
        }),
        prisma.walletTxn.create({
          data: { userId: metadata.userId, type: 'DEBIT', amount, reference: ref, status: 'completed' },
        }),
        prisma.notification.create({
          data: { userId: metadata.userId, type: 'PAYMENT', title: 'Subscription activated', message: `Your ${metadata.tier} subscription is now active.` },
        }),
      ]);
    }
  } catch (err: any) {
    // P2002 = unique constraint violation on reference — a second webhook
    // delivery raced this one and won; the payment is already recorded, so
    // this is a safe no-op rather than a real failure.
    if (err?.code !== 'P2002') {
      console.error('Paystack webhook processing failed:', err?.message || err);
      return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
