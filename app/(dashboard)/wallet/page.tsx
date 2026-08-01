import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { WalletFundButton } from '@/components/dashboard/wallet-fund-button';
import { formatCurrency } from '@/lib/utils';

export default async function WalletPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const [me, txns] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.userId }, select: { walletBalance: true, subscriptionTier: true, subscriptionExpiry: true } }),
    prisma.walletTxn.findMany({ where: { userId: session.userId }, orderBy: { createdAt: 'desc' }, take: 50 }),
  ]);
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold tracking-tight">Wallet</h1><p className="text-sm text-lipro-600/70 dark:text-lipro-200/70">Manage your LIPRO balance</p></div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card><CardHeader><CardDescription>Current balance</CardDescription><CardTitle className="text-3xl">{formatCurrency(me?.walletBalance || 0)}</CardTitle></CardHeader><CardContent><WalletFundButton /></CardContent></Card>
        <Card><CardHeader><CardDescription>Subscription</CardDescription><CardTitle className="text-lg">{me?.subscriptionTier}</CardTitle></CardHeader><CardContent>{me?.subscriptionExpiry ? <p className="text-xs text-lipro-600/60">Active until {new Date(me.subscriptionExpiry).toLocaleDateString()}</p> : <p className="text-xs text-lipro-600/60">No active subscription</p>}<a href="/subscription" className="text-xs font-medium text-lipro-600 hover:underline">Change plan</a></CardContent></Card>
      </div>
      <Card><CardHeader><CardTitle>Transactions</CardTitle><CardDescription>Your recent wallet activity</CardDescription></CardHeader><CardContent>
        <div className="space-y-2">
          {txns.length === 0 && <p className="text-sm text-lipro-600/60">No transactions yet.</p>}
          {txns.map((t) => (
            <div key={t.id} className="flex items-center justify-between rounded-xl p-3 glass-hover">
              <div><div className="text-sm font-medium">{t.type} · {t.reference || '—'}</div><div className="text-xs text-lipro-600/60">{new Date(t.createdAt).toLocaleString()}</div></div>
              <Badge tone={t.type === 'CREDIT' ? 'green' : 'rose'}>{t.type === 'CREDIT' ? '+' : '-'}{formatCurrency(t.amount)}</Badge>
            </div>
          ))}
        </div>
      </CardContent></Card>
    </div>
  );
}