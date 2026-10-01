'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Brain, Loader2, Timer, ListChecks, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createAttempt, type AttemptSource } from '@/lib/cbt/client';
import { QUESTION_COUNTS, DURATION_MINUTES } from '@/lib/cbt/constants';
import { FORMAT_LABELS, type QuestionFormat } from '@/lib/question-gen';

const ALL_FORMATS: QuestionFormat[] = ['MCQ', 'TRUE_FALSE', 'FILL_BLANK'];

export function ExamLauncher({
  source,
  defaultMode = 'practice',
  defaultCount = 10,
  defaultDurationMin = 15,
  startLabel,
  typeCounts,
}: {
  source: AttemptSource;
  defaultMode?: 'practice' | 'exam';
  defaultCount?: number;
  defaultDurationMin?: number;
  startLabel?: string;
  typeCounts?: Partial<Record<QuestionFormat, number>>;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<'practice' | 'exam'>(defaultMode);
  const [count, setCount] = useState(defaultCount);
  const [durationMin, setDurationMin] = useState(defaultDurationMin);
  const firstAvailable = typeCounts ? ALL_FORMATS.find((f) => (typeCounts[f] || 0) > 0) ?? 'MCQ' : 'MCQ';
  const [format, setFormat] = useState<QuestionFormat>(firstAvailable);
  const [adaptive, setAdaptive] = useState(true);
  const [blueprint, setBlueprint] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const start = async () => {
    setLoading(true);
    setError('');
    try {
      const useTypes = typeCounts && !blueprint ? [format] : undefined;
      const result = await createAttempt({
        source,
        mode,
        count: blueprint ? Math.max(count, 15) : count,
        durationSec: mode === 'exam' ? durationMin * 60 : undefined,
        types: useTypes,
        adaptive: mode === 'practice' ? adaptive : false,
      });
      router.push(`/cbt/${result.attemptId}`);
    } catch (err: any) {
      setError(err?.message || 'Could not start');
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap gap-1.5">
        {(['practice', 'exam'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={cn(
              'h-8 rounded-full px-3 text-xs font-medium capitalize shadow-studio-border',
              mode === m
                ? 'bg-studio-primary text-studio-primary-fg'
                : 'bg-studio-elevated text-studio-muted hover:text-studio-fg',
            )}
          >
            {m}
          </button>
        ))}
      </div>

      {typeCounts && !blueprint && (
        <label className="flex items-center gap-1.5 text-xs text-studio-muted">
          Format
          <select
            className="h-8 rounded-md bg-studio-elevated px-2 text-xs text-studio-fg shadow-studio-border outline-none"
            value={format}
            onChange={(e) => setFormat(e.target.value as QuestionFormat)}
            aria-label="Question format"
          >
            {ALL_FORMATS.map((f) => {
              const n = typeCounts[f] || 0;
              return (
                <option key={f} value={f} disabled={n === 0}>
                  {FORMAT_LABELS[f]} ({n})
                </option>
              );
            })}
          </select>
        </label>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <label className="flex items-center gap-1.5 text-xs text-studio-muted">
          <ListChecks className="h-3.5 w-3.5" />
          <select
            className="h-8 rounded-md bg-studio-elevated px-2 text-xs text-studio-fg shadow-studio-border outline-none"
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            aria-label="Number of questions"
          >
            {QUESTION_COUNTS.map((c) => (
              <option key={c} value={c}>
                {c} questions
              </option>
            ))}
          </select>
        </label>
        {mode === 'exam' && (
          <label className="flex items-center gap-1.5 text-xs text-studio-muted">
            <Timer className="h-3.5 w-3.5" />
            <select
              className="h-8 rounded-md bg-studio-elevated px-2 text-xs text-studio-fg shadow-studio-border outline-none"
              value={durationMin}
              onChange={(e) => setDurationMin(Number(e.target.value))}
              aria-label="Exam duration"
            >
              {DURATION_MINUTES.map((d) => (
                <option key={d} value={d}>
                  {d} min
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        {mode === 'practice' && (
          <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-studio-muted">
            <input
              type="checkbox"
              checked={adaptive}
              onChange={(e) => setAdaptive(e.target.checked)}
              className="rounded border-studio-border"
            />
            Adaptive (weak topics)
          </label>
        )}
        <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-studio-muted">
          <input
            type="checkbox"
            checked={blueprint}
            onChange={(e) => setBlueprint(e.target.checked)}
            className="rounded border-studio-border"
          />
          <Sparkles className="h-3 w-3" />
          Mock blueprint (mixed formats)
        </label>
      </div>

      <button
        type="button"
        onClick={start}
        disabled={loading || (!blueprint && typeCounts ? (typeCounts[format] || 0) === 0 : false)}
        className="inline-flex h-9 items-center gap-1.5 rounded-full bg-studio-primary px-4 text-xs font-medium text-studio-primary-fg disabled:opacity-50"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
        {loading
          ? 'Starting…'
          : startLabel ||
            (blueprint
              ? mode === 'exam'
                ? 'Start mock exam'
                : 'Start mixed practice'
              : mode === 'practice'
                ? 'Start practice'
                : 'Start exam')}
      </button>
      {error && <p className="text-xs text-studio-danger">{error}</p>}
    </div>
  );
}
