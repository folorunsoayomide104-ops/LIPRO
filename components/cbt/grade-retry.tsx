'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, Loader2, AlertTriangle } from 'lucide-react';

export function GradeRetryBanner({
  attemptId,
  status,
}: {
  attemptId: string;
  status: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!['failed', 'degraded', 'pending', 'grading'].includes(status)) return null;
  if (status === 'grading' || status === 'pending') {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-studio-elevated px-4 py-3 text-sm text-studio-muted">
        <Loader2 className="h-4 w-4 animate-spin text-studio-primary" />
        Grading written answers…
      </div>
    );
  }

  const retry = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/cbt/attempts/${attemptId}/grade`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Retry failed — check your connection and try again');
      }
      router.refresh();
    } catch (e: any) {
      setError(e?.message || 'Network error — try again when online');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <div>
            <p className="text-sm font-medium text-studio-fg">
              {status === 'failed' ? 'Grading did not finish' : 'Partial grading result'}
            </p>
            <p className="mt-0.5 text-xs text-studio-muted">
              Your answers are saved. Retry when the connection is stable — no need to resubmit.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={retry}
          disabled={loading}
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-studio-primary px-3.5 text-xs font-semibold text-studio-primary-fg disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Retry grading
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-studio-danger">{error}</p>}
    </div>
  );
}
