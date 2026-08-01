'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus } from 'lucide-react';

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
    } else alert(data?.error || 'Failed');
  };
  if (!open) return <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Fund wallet</Button>;
  return (
    <div className="flex gap-2">
      <Input type="number" min={100} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
      <Button onClick={fund} disabled={loading}>{loading ? 'Processing…' : 'Fund'}</Button>
      <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
    </div>
  );
}