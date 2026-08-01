import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UpgradeButton } from '@/components/dashboard/upgrade-button';
import { Check } from 'lucide-react';

const PLANS = [
  { name: 'Free', price: '\u20A60', tier: 'FREE', features: ['Limited AI questions', 'Practice mode (5/day)', 'Public notes'], desc: 'Your starter plan' },
  { name: 'Premium', price: '\u20A61,700/mo', tier: 'PREMIUM', features: ['Unlimited LIPRO AI', 'PDF intelligence', 'Full CBT engine', 'Notes & courses', 'Study planner'], desc: 'For serious students', highlight: true },
  { name: 'Ultimate', price: '\u20A63,000/mo', tier: 'ULTIMATE', features: ['Everything in Premium', 'Priority AI responses', 'Custom AI prompts', 'Flashcards & auto-summaries', 'Analytics dashboard', 'Wallet top-ups'], desc: 'The complete toolkit' },
];

export default async function SubscriptionPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const me = await prisma.user.findUnique({ where: { id: session.userId }, select: { subscriptionTier: true } });
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold tracking-tight">Subscriptions</h1><p className="text-sm text-lipro-600/70 dark:text-lipro-200/70">Current plan: <Badge tone="purple">{me?.subscriptionTier}</Badge></p></div>
      <div className="grid gap-6 md:grid-cols-3">
        {PLANS.map((plan) => (
          <Card key={plan.tier} className={plan.highlight ? 'ring-2 ring-lipro-400/40' : ''}>
            <CardHeader><CardTitle>{plan.name}</CardTitle><CardDescription>{plan.desc}</CardDescription></CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{plan.price}</div>
              <ul className="mt-4 space-y-2">
                {plan.features.map((f) => <li key={f} className="flex items-start gap-2 text-sm"><Check className="mt-0.5 h-4 w-4 text-lipro-600" />{f}</li>)}
              </ul>
              {me?.subscriptionTier === plan.tier ? (
                <Badge tone="green" className="mt-6">Current plan</Badge>
              ) : (
                <UpgradeButton plan={plan.tier.toLowerCase() as 'premium' | 'ultimate'} />
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}