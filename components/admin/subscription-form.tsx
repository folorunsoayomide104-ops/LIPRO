'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export function SubscriptionAdminForm({
  userId,
  currentTier,
}: {
  userId: string;
  currentTier: string;
}) {
  const router = useRouter();
  const [tier, setTier] = useState(currentTier || 'FREE');
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const save = async () => {
    setLoading(true);
    setMsg('');
    try {
      const res = await fetch('/api/admin/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          tier,
          extendDays: tier === 'FREE' ? undefined : days,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Update failed');
      setMsg('Updated');
      router.refresh();
    } catch (e: any) {
      setMsg(e?.message || 'Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl bg-studio-surface p-5 shadow-studio-border">
      <h2 className="font-studio-display text-lg text-studio-fg">Subscription</h2>
      <p className="mt-1 text-xs text-studio-muted">Grant, revoke, or extend a paid plan</p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="text-xs text-studio-muted">
          Tier
          <select
            className="mt-1 block h-9 rounded-lg bg-studio-elevated px-2 text-sm text-studio-fg shadow-studio-border"
            value={tier}
            onChange={(e) => setTier(e.target.value)}
          >
            <option value="FREE">FREE</option>
            <option value="PREMIUM">PREMIUM</option>
            <option value="ULTIMATE">ULTIMATE</option>
          </select>
        </label>
        {tier !== 'FREE' && (
          <label className="text-xs text-studio-muted">
            Extend days
            <input
              type="number"
              min={1}
              max={365}
              value={days}
              onChange={(e) => setDays(Number(e.target.value) || 30)}
              className="mt-1 block h-9 w-24 rounded-lg bg-studio-elevated px-2 text-sm text-studio-fg shadow-studio-border"
            />
          </label>
        )}
        <button
          type="button"
          onClick={save}
          disabled={loading}
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-studio-primary px-4 text-xs font-semibold text-studio-primary-fg disabled:opacity-50"
        >
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Save
        </button>
      </div>
      {msg && <p className="mt-2 text-xs text-studio-muted">{msg}</p>}
    </div>
  );
}
