'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Target, Loader2 } from 'lucide-react';
import { createAttempt } from '@/lib/cbt/client';

export type WeakTopicRow = {
  key: string;
  label: string;
  kind: string;
  accuracyPct: number;
  answered: number;
  materialId?: string;
  courseId?: string;
};

export function WeakTopicDrill({ topics }: { topics: WeakTopicRow[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState('');

  const concepts = topics.filter((t) => t.kind === 'concept' && t.accuracyPct < 75);
  const sources = topics.filter((t) => t.kind !== 'concept');

  if (concepts.length === 0 && sources.length === 0) return null;

  const startDrill = async (t: WeakTopicRow) => {
    const materialId = t.materialId;
    const courseId = t.courseId;
    if (!materialId && !courseId) {
      setError('No linked material or course for this topic yet.');
      return;
    }
    setLoading(t.key);
    setError('');
    try {
      const result = await createAttempt({
        source: materialId ? { kind: 'material', id: materialId } : { kind: 'course', id: courseId! },
        mode: 'practice',
        count: 10,
        adaptive: true,
      });
      router.push(`/cbt/${result.attemptId}`);
    } catch (err: any) {
      setError(err?.message || 'Could not start drill');
      setLoading(null);
    }
  };

  return (
    <section className="min-w-0 rounded-xl bg-studio-surface p-4 shadow-studio-border sm:p-5 studio-rise">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-studio-subtle">Adaptive practice</p>
      <h2 className="mt-1 font-studio-display text-xl tracking-tight text-studio-fg">Your weak topics</h2>
      <p className="mt-1 text-sm text-studio-muted">
        Based on past graded attempts. Drill focuses more questions on topics you miss.
      </p>
      <div className="mt-4 flex flex-col gap-2">
        {(concepts.length ? concepts : sources).slice(0, 6).map((t) => (
          <div key={t.key} className="flex items-center justify-between gap-3 rounded-lg bg-studio-elevated px-4 py-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-studio-fg">{t.label}</div>
              <div className="text-xs text-studio-subtle">
                {t.accuracyPct}% accuracy · {t.answered} answered
                {t.kind === 'concept' ? ' · concept' : ''}
              </div>
            </div>
            <button
              type="button"
              disabled={!!loading || (!t.materialId && !t.courseId)}
              onClick={() => startDrill(t)}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-studio-primary px-3 text-xs font-medium text-studio-primary-fg disabled:opacity-40"
            >
              {loading === t.key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Target className="h-3.5 w-3.5" />}
              Drill
            </button>
          </div>
        ))}
      </div>
      {error && <p className="mt-2 text-xs text-studio-danger">{error}</p>}
    </section>
  );
}
