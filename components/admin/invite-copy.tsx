'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

export function AdminInviteCopy({ url }: { url: string }) {
  const [done, setDone] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setDone(true);
      setTimeout(() => setDone(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex h-8 items-center gap-1 rounded-full bg-studio-primary px-3 text-xs font-semibold text-studio-primary-fg"
    >
      {done ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {done ? 'Copied' : 'Copy link'}
    </button>
  );
}
