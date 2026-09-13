'use client';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

export function WalletFundButton() {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(1000);
  const [loading, setLoading] = useState(false);
  const fund = async () => {
    setLoading(true);
    const res = await fetch('/api/wallet/fund', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount }) });
    const data = await res.json().catch(() => null);
    setLoading(false);
    if (res.ok) {
      if (data.authorizationUrl) window.location.href = data.authorizationUrl;
      else location.reload();
    } else toast.error(data?.error || 'Could not fund your wallet. Please try again.');
  };
  if (!open) return (
    <button type="button" onClick={() => setOpen(true)} className="inline-flex h-10 items-center gap-1.5 rounded-full bg-studio-primary px-4 text-sm font-medium text-studio-primary-fg">
      <Plus className="h-4 w-4" /> Fund wallet
    </button>
  );
  return (
    <div className="flex gap-2">
      <input
        type="number"
        min={100}
        value={amount}
        onChange={(e) => setAmount(Number(e.target.value))}
        className="h-10 w-28 rounded-lg bg-studio-elevated px-3 text-sm text-studio-fg shadow-studio-border outline-none"
      />
      <button type="button" onClick={fund} disabled={loading} className="inline-flex h-10 items-center rounded-full bg-studio-primary px-4 text-sm font-medium text-studio-primary-fg disabled:opacity-60">
        {loading ? 'Processing…' : 'Fund'}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="inline-flex h-10 items-center rounded-full px-4 text-sm font-medium text-studio-subtle hover:text-studio-fg">Cancel</button>
    </div>
  );
}
