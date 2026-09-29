'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Target, Loader2, TrendingDown, TrendingUp, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createAttempt } from '@/lib/cbt/client';
import type { ConceptMastery } from '@/lib/cbt/mastery';

export type ResultsMasteryProps = {
  concepts: ConceptMastery[];
  /** Source to launch an adaptive drill from */
  materialId?: string | null;
  courseId?: string | null;
  overallPct: number;
};

function barColor(pct: number): string {
  if (pct >= 75) return 'bg-emerald-500';
  if (pct >= 50) return 'bg-amber-500';
  return 'bg-rose-500';
}

function textTone(pct: number): string {
  if (pct >= 75) return 'text-emerald-400';
  if (pct >= 50) return 'text-amber-400';
  return 'text-rose-400';
}

export function ResultsMastery({ concepts, materialId, courseId, overallPct }: ResultsMasteryProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const weak = concepts.filter((c) => c.topic !== 'General' && c.accuracyPct < 70);
  const strong = concepts.filter((c) => c.topic !== 'General' && c.accuracyPct >= 75);
  const canDrill = !!(materialId || courseId) && weak.length > 0;

  const startDrill = async () => {
    if (!canDrill) return;
    setLoading(true);
    setError('');
    try {
      const result = await createAttempt({
        source: materialId
          ? { kind: 'material', id: materialId }
          : { kind: 'course', id: courseId! },
        mode: 'practice',
        count: Math.min(15, Math.max(8, weak.length * 3)),
        adaptive: true,
      });
      router.push(`/cbt/${result.attemptId}`);
    } catch (err: any) {
      setError(err?.message || 'Could not start drill');
      setLoading(false);
    }
  };

  if (concepts.length === 0) return null;

  return (
    <section className="min-w-0 rounded-xl bg-studio-surface p-4 shadow-studio-border sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-studio-subtle">Mastery path</p>
          <h2 className="mt-1 font-studio-display text-xl tracking-tight text-studio-fg">
            Concept breakdown
          </h2>
          <p className="mt-1 text-sm text-studio-muted">
            {weak.length > 0
              ? `You struggled most on ${weak.slice(0, 3).map((c) => c.topic).join(', ')}${weak.length > 3 ? ` +${weak.length - 3}` : ''}.`
              : overallPct >= 75
                ? 'Solid mastery across topics — keep the momentum.'
                : 'Review the questions below to lock in the concepts.'}
          </p>
        </div>
        {canDrill && (
          <button
            type="button"
            disabled={loading}
            onClick={startDrill}
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-studio-primary px-4 text-sm font-medium text-studio-primary-fg disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Target className="h-4 w-4" />}
            Drill weak topics
          </button>
        )}
      </div>

      {error && <p className="mt-2 text-xs text-studio-danger">{error}</p>}

      <div className="mt-5 flex flex-col gap-3">
        {concepts.map((c) => (
          <div
            key={c.topic}
            className="rounded-lg bg-studio-elevated px-4 py-3"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex items-center gap-2">
                {c.accuracyPct < 50 ? (
                  <TrendingDown className="h-3.5 w-3.5 shrink-0 text-rose-400" />
                ) : c.accuracyPct >= 75 ? (
                  <TrendingUp className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                )}
                <span className="truncate text-sm font-medium text-studio-fg" title={c.topic}>
                  {c.topic}
                </span>
              </div>
              <span className={cn('shrink-0 text-sm font-medium tabular-nums', textTone(c.accuracyPct))}>
                {c.accuracyPct}%
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-studio-bg">
              <div
                className={cn('h-full rounded-full transition-[width] duration-500', barColor(c.accuracyPct))}
                style={{ width: `${Math.min(100, Math.max(4, c.accuracyPct))}%` }}
              />
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-studio-subtle">
              <span>
                {c.correct}/{c.answered} correct · {c.awarded}/{c.points} pts
              </span>
              {(['easy', 'medium', 'hard'] as const).map((d) => {
                const db = c.byDifficulty[d];
                if (!db || db.answered === 0) return null;
                return (
                  <span key={d} className="capitalize">
                    {d}: {db.correct}/{db.answered}
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {strong.length > 0 && weak.length > 0 && (
        <p className="mt-4 text-xs text-studio-muted">
          Strong on {strong.slice(0, 2).map((c) => c.topic).join(', ')}
          {strong.length > 2 ? ` +${strong.length - 2}` : ''}. Focus drills on the lower bars.
        </p>
      )}
    </section>
  );
}
