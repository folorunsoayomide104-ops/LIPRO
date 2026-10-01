import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/api-guard';
import { logAdminAudit } from '@/lib/admin/audit';

const TIERS = new Set(['FREE', 'PREMIUM', 'ULTIMATE']);

export async function POST(req: Request) {
  const { ok, user, response } = await guard('ADMIN');
  if (!ok || !user) return response!;

  const body = await req.json().catch(() => null);
  if (!body || typeof body.userId !== 'string') {
    return NextResponse.json({ error: 'userId required' }, { status: 400 });
  }

  const tier = typeof body.tier === 'string' ? body.tier.toUpperCase() : null;
  if (!tier || !TIERS.has(tier)) {
    return NextResponse.json({ error: 'tier must be FREE, PREMIUM, or ULTIMATE' }, { status: 422 });
  }

  const days =
    typeof body.extendDays === 'number' && body.extendDays > 0 && body.extendDays <= 365
      ? body.extendDays
      : null;

  const target = await prisma.user.findFirst({
    where: { id: body.userId, role: 'STUDENT' },
    select: { id: true, email: true, subscriptionTier: true, subscriptionExpiry: true },
  });
  if (!target) return NextResponse.json({ error: 'Student not found' }, { status: 404 });

  let subscriptionExpiry: Date | null = target.subscriptionExpiry;
  if (tier === 'FREE') {
    subscriptionExpiry = null;
  } else if (days) {
    const base =
      subscriptionExpiry && subscriptionExpiry > new Date() ? subscriptionExpiry : new Date();
    subscriptionExpiry = new Date(base.getTime() + days * 86400000);
  } else if (!subscriptionExpiry || subscriptionExpiry < new Date()) {
    subscriptionExpiry = new Date(Date.now() + 30 * 86400000);
  }

  await prisma.user.update({
    where: { id: target.id },
    data: { subscriptionTier: tier, subscriptionExpiry },
  });

  await logAdminAudit({
    actorUserId: user.userId,
    actorEmail: user.email,
    action: 'subscription_update',
    detail: `${target.email} → ${tier}${days ? ` (+${days}d)` : ''}`,
    broadcast: true,
  });

  await prisma.notification.create({
    data: {
      userId: target.id,
      type: 'PAYMENT',
      title: 'Subscription updated',
      message: `Your plan is now ${tier}${subscriptionExpiry ? ` until ${subscriptionExpiry.toLocaleDateString()}` : ''}.`,
    },
  });

  return NextResponse.json({
    ok: true,
    tier,
    subscriptionExpiry: subscriptionExpiry?.toISOString() ?? null,
  });
}
