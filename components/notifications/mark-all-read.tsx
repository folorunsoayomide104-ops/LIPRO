'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCheck, Loader2 } from 'lucide-react';

export function MarkAllReadButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const mark = async () => {
    setLoading(true);
    try {
      await fetch('/api/notifications/read-all', { method: 'POST' });
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={mark}
      disabled={loading}
      className="inline-flex h-9 items-center gap-1.5 rounded-full bg-studio-elevated px-3.5 text-xs font-semibold text-studio-muted shadow-studio-border hover:text-studio-fg disabled:opacity-50"
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
      Mark all read
    </button>
  );
}
