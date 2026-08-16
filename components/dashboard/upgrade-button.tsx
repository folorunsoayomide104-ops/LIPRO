'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export function UpgradeButton({ plan }: { plan: 'premium' | 'ultimate' }) {
  const [loading, setLoading] = useState(false);
  const upgrade = async () => {
    setLoading(true);
    const res = await fetch('/api/paystack/initialize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan }) });
    const data = await res.json().catch(() => null);
    setLoading(false);
    if (res.ok) {
      if (data.authorizationUrl) window.location.href = data.authorizationUrl;
      else location.reload();
    } else toast.error(data?.error || 'Could not start the upgrade. Please try again.');
  };
  return <Button className="mt-6 w-full" onClick={upgrade} disabled={loading} variant={plan === 'premium' ? 'primary' : 'outline'}>{loading ? 'Processing...' : `Upgrade to ${plan}`}</Button>;
}