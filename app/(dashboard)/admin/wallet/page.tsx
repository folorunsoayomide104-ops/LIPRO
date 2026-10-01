import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import Link from 'next/link';
import { ArrowLeft, Wallet, CreditCard } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export default async function AdminWalletPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role !== 'ADMIN') redirect('/dashboard');

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [walletSum, debitSum, creditSum, recentTxns, paidStudents] = await Promise.all([
    prisma.user.aggregate({ _sum: { walletBalance: true }, where: { role: 'STUDENT' } }),
    prisma.walletTxn.aggregate({
      _sum: { amount: true },
      where: { type: 'DEBIT', createdAt: { gte: thirtyDaysAgo } },
    }),
    prisma.walletTxn.aggregate({
      _sum: { amount: true },
      where: { type: 'CREDIT', createdAt: { gte: thirtyDaysAgo } },
    }),
    prisma.walletTxn.findMany({
      orderBy: { createdAt: 'desc' },
      take: 40,
      select: {
        id: true,
        type: true,
        amount: true,
        status: true,
        createdAt: true,
        user: { select: { fullName: true, email: true, subscriptionTier: true } },
      },
    }),
    prisma.user.count({
      where: { role: 'STUDENT', subscriptionTier: { not: 'FREE' } },
    }),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-8">
      <header className="studio-rise">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 text-xs font-medium text-studio-muted hover:text-studio-fg"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to admin
        </Link>
        <h1 className="mt-2 flex items-center gap-2 font-studio-display text-2xl tracking-tight text-studio-fg">
          <Wallet className="h-6 w-6 text-studio-primary" />
          Wallet & subscriptions
        </h1>
        <p className="mt-1 text-sm text-studio-muted">Float, payments, and recent wallet activity</p>
      </header>

      <section className="studio-rise grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          {
            label: 'Student wallet float',
            value: formatCurrency(walletSum._sum.walletBalance ?? 0),
          },
          {
            label: 'Debits (30d)',
            value: formatCurrency(debitSum._sum.amount ?? 0),
            hint: 'Subscription charges',
          },
          {
            label: 'Credits (30d)',
            value: formatCurrency(creditSum._sum.amount ?? 0),
            hint: 'Top-ups',
          },
          {
            label: 'Paid plans',
            value: String(paidStudents),
            hint: 'Non-FREE students',
          },
        ].map((k) => (
          <div key={k.label} className="rounded-2xl bg-studio-surface p-4 shadow-studio-border">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-studio-subtle">
              {k.label}
            </p>
            <p className="tnum mt-1.5 font-studio-display text-xl text-studio-fg">{k.value}</p>
            {'hint' in k && k.hint && <p className="mt-1 text-xs text-studio-muted">{k.hint}</p>}
          </div>
        ))}
      </section>

      <section className="studio-rise rounded-2xl bg-studio-surface p-5 shadow-studio-border sm:p-6">
        <h2 className="flex items-center gap-2 font-studio-display text-xl text-studio-fg">
          <CreditCard className="h-4 w-4 text-studio-primary" />
          Recent transactions
        </h2>
        {recentTxns.length === 0 ? (
          <p className="mt-4 text-sm text-studio-subtle">No wallet transactions yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead>
                <tr className="border-b border-studio-border text-[11px] uppercase tracking-wide text-studio-subtle">
                  <th className="pb-2 pr-3">Student</th>
                  <th className="pb-2 pr-3">Type</th>
                  <th className="pb-2 pr-3">Amount</th>
                  <th className="pb-2 pr-3">Status</th>
                  <th className="pb-2">When</th>
                </tr>
              </thead>
              <tbody>
                {recentTxns.map((t) => (
                  <tr key={t.id} className="border-b border-studio-border/70 last:border-0">
                    <td className="py-2.5 pr-3">
                      <p className="font-medium text-studio-fg">{t.user.fullName}</p>
                      <p className="text-xs text-studio-subtle">
                        {t.user.email} · {t.user.subscriptionTier}
                      </p>
                    </td>
                    <td className="py-2.5 pr-3">
                      <Badge tone={t.type === 'CREDIT' ? 'green' : 'amber'}>{t.type}</Badge>
                    </td>
                    <td className="tnum py-2.5 pr-3 font-medium text-studio-fg">
                      {formatCurrency(t.amount)}
                    </td>
                    <td className="py-2.5 pr-3 text-studio-muted">{t.status}</td>
                    <td className="py-2.5 text-studio-subtle">
                      {new Date(t.createdAt).toLocaleString(undefined, {
                        day: 'numeric',
                        month: 'short',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
