'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarClock, Loader2, Target, Layers } from 'lucide-react';
import { createAttempt } from '@/lib/cbt/client';

export type DueReviewRow = {
  key: string;
  label: string;
  accuracyPct: number;
  answered: number;
  daysSince: number;
  intervalDays: number;
  isDue: boolean;
  materialId?: string;
  courseId?: string;
};

export function DueReview({ items }: { items: DueReviewRow[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState('');

  const due = items.filter((t) => t.isDue);
  if (due.length === 0) return null;

  const startReview = async (t: DueReviewRow) => {
    if (!t.materialId && !t.courseId) {
      setError('No linked material or course for this topic yet.');
      return;
    }
    setLoading(t.key);
    setError('');
    try {
      const result = await createAttempt({
        source: t.materialId
          ? { kind: 'material', id: t.materialId }
          : { kind: 'course', id: t.courseId! },
        mode: 'practice',
        count: 10,
        adaptive: true,
      });
      router.push(`/cbt/${result.attemptId}`);
    } catch (err: any) {
      setError(err?.message || 'Could not start review');
      setLoading(null);
    }
  };

  const startAllDue = async () => {
    const withSource = due.find((t) => t.materialId || t.courseId);
    if (!withSource) {
      setError('No linked material or course for due topics yet.');
      return;
    }
    setLoading('__all__');
    setError('');
    try {
      const result = await createAttempt({
        source: withSource.materialId
          ? { kind: 'material', id: withSource.materialId }
          : { kind: 'course', id: withSource.courseId! },
        mode: 'practice',
        count: Math.min(20, Math.max(10, due.length * 3)),
        adaptive: true,
      });
      router.push(`/cbt/${result.attemptId}`);
    } catch (err: any) {
      setError(err?.message || 'Could not start review');
      setLoading(null);
    }
  };

  return (
    <section className="min-w-0 rounded-xl bg-studio-surface p-4 shadow-studio-border sm:p-5 studio-rise">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-studio-subtle">Spaced review</p>
          <h2 className="mt-1 font-studio-display text-xl tracking-tight text-studio-fg">Due for review</h2>
          <p className="mt-1 text-sm text-studio-muted">
            Topics whose review interval has elapsed — shorter intervals for weaker accuracy.
          </p>
        </div>
        <button
          type="button"
          onClick={startAllDue}
          disabled={!!loading}
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-studio-primary px-3.5 text-xs font-semibold text-studio-primary-fg disabled:opacity-50"
        >
          {loading === '__all__' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Layers className="h-3.5 w-3.5" />
          )}
          Review all due ({due.length})
        </button>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {due.slice(0, 6).map((t) => (
          <div
            key={t.key}
            className="flex items-center justify-between gap-3 rounded-lg bg-studio-elevated px-4 py-3"
          >
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-studio-fg">{t.label}</div>
              <div className="flex flex-wrap items-center gap-x-2 text-xs text-studio-subtle">
                <span className="inline-flex items-center gap-1 text-amber-400">
                  <CalendarClock className="h-3 w-3" />
                  {t.daysSince === 0 ? 'Today' : `${t.daysSince}d ago`}
                </span>
                <span>·</span>
                <span>{t.accuracyPct}% accuracy</span>
                <span>·</span>
                <span>every {t.intervalDays}d</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => startReview(t)}
              disabled={!!loading}
              className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full bg-studio-surface px-3 text-xs font-medium text-studio-primary shadow-studio-border disabled:opacity-50"
            >
              {loading === t.key ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Target className="h-3.5 w-3.5" />
              )}
              Review
            </button>
          </div>
        ))}
      </div>
      {error && <p className="mt-3 text-xs text-studio-danger">{error}</p>}
    </section>
  );
}
