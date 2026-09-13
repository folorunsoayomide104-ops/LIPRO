import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
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
    <div className="-mx-4 -mt-2 min-h-[calc(100dvh-4rem)] bg-studio-bg p-4 text-studio-fg md:p-6">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <header className="studio-rise">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-studio-subtle">Wallet</p>
          <h1 className="mt-2 font-studio-display text-3xl tracking-tight md:text-4xl">Your balance.</h1>
          <p className="mt-2 max-w-lg text-sm leading-normal text-studio-muted">Manage your LIPRO balance.</p>
        </header>

        <div className="grid gap-4 md:grid-cols-2 studio-rise studio-rise-delay-1">
          <div className="rounded-xl bg-studio-surface p-5 shadow-studio-border">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-studio-subtle">Current balance</p>
            <p className="mt-2 font-studio-display text-4xl tracking-tight text-studio-fg">{formatCurrency(me?.walletBalance || 0)}</p>
            <div className="mt-4"><WalletFundButton /></div>
          </div>
          <div className="rounded-xl bg-studio-surface p-5 shadow-studio-border">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-studio-subtle">Subscription</p>
            <p className="mt-2 font-studio-display text-xl tracking-tight text-studio-fg">{me?.subscriptionTier}</p>
            {me?.subscriptionExpiry ? (
              <p className="mt-2 text-xs text-studio-subtle">Active until {new Date(me.subscriptionExpiry).toLocaleDateString()}</p>
            ) : (
              <p className="mt-2 text-xs text-studio-subtle">No active subscription</p>
            )}
            <a href="/subscription" className="mt-2 inline-block text-xs font-medium text-studio-primary hover:underline">Change plan</a>
          </div>
        </div>

        <section className="rounded-xl bg-studio-surface p-5 shadow-studio-border studio-rise studio-rise-delay-2">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-studio-subtle">Transactions</p>
          <p className="mt-1 text-sm text-studio-muted">Your recent wallet activity.</p>
          <div className="mt-4 flex flex-col gap-2">
            {txns.length === 0 && <p className="text-sm text-studio-subtle">No transactions yet.</p>}
            {txns.map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-lg bg-studio-elevated p-3">
                <div>
                  <div className="text-sm font-medium text-studio-fg">{t.type} · {t.reference || '—'}</div>
                  <div className="text-xs text-studio-subtle">{new Date(t.createdAt).toLocaleString()}</div>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${t.type === 'CREDIT' ? 'bg-studio-primary/15 text-studio-primary' : 'bg-studio-danger/15 text-studio-danger'}`}>
                  {t.type === 'CREDIT' ? '+' : '-'}{formatCurrency(t.amount)}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
