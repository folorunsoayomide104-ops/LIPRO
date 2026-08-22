'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Brain, Loader2, Timer, ListChecks } from 'lucide-react';
import { createAttempt, type AttemptSource } from '@/lib/cbt/client';
import { QUESTION_COUNTS, DURATION_MINUTES } from '@/lib/cbt/constants';
import { FORMAT_LABELS, type QuestionFormat } from '@/lib/question-gen';

const ALL_FORMATS: QuestionFormat[] = ['MCQ', 'TRUE_FALSE', 'FILL_BLANK', 'THEORY'];

/**
 * Mode/count/duration picker + "Start" button. Replaces the mode/count/
 * duration logic that used to be duplicated (with divergent option lists)
 * between start-exam-button and pdf-exam-creator.
 */
export function ExamLauncher({
  source,
  defaultMode = 'practice',
  defaultCount = 10,
  defaultDurationMin = 15,
  startLabel,
  /** Real per-format question counts already in the bank, e.g. { MCQ: 12, THEORY: 3 }. Formats at 0 (or omitted) are disabled rather than hidden, so a student can see what's missing. */
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const start = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await createAttempt({
        source,
        mode,
        count,
        durationSec: mode === 'exam' ? durationMin * 60 : undefined,
        types: typeCounts ? [format] : undefined,
      });
      router.push(`/cbt/${result.attemptId}`);
    } catch (err: any) {
      setError(err?.message || 'Could not start');
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-1 rounded-xl border border-lipro-200/60 bg-lipro-50/50 p-1 dark:border-lipro-500/20 dark:bg-lipro-950/30">
        <button
          type="button"
          onClick={() => setMode('practice')}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${mode === 'practice' ? 'bg-lipro-600 text-white shadow-sm' : 'text-lipro-600/80 hover:bg-lipro-100/60 dark:text-lipro-200/70'}`}
        >
          Practice
        </button>
        <button
          type="button"
          onClick={() => setMode('exam')}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${mode === 'exam' ? 'bg-lipro-600 text-white shadow-sm' : 'text-lipro-600/80 hover:bg-lipro-100/60 dark:text-lipro-200/70'}`}
        >
          Exam mode
        </button>
      </div>

      {typeCounts && (
        <label className="flex items-center gap-1.5 text-xs text-lipro-600/80 dark:text-lipro-200/70">
          Format
          <select className="input !py-1 text-xs" value={format} onChange={(e) => setFormat(e.target.value as QuestionFormat)} aria-label="Question format">
            {ALL_FORMATS.map((f) => {
              const n = typeCounts[f] || 0;
              return <option key={f} value={f} disabled={n === 0}>{FORMAT_LABELS[f]} ({n})</option>;
            })}
          </select>
        </label>
      )}

      <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1.5">
        <label className="flex items-center gap-1.5 text-xs text-lipro-600/80 dark:text-lipro-200/70">
          <ListChecks className="h-3.5 w-3.5" />
          <select className="input !py-1 text-xs" value={count} onChange={(e) => setCount(Number(e.target.value))} aria-label="Number of questions">
            {QUESTION_COUNTS.map((c) => <option key={c} value={c}>{c} questions</option>)}
          </select>
        </label>
        {mode === 'exam' && (
          <label className="flex items-center gap-1.5 text-xs text-lipro-600/80 dark:text-lipro-200/70">
            <Timer className="h-3.5 w-3.5" />
            <select className="input !py-1 text-xs" value={durationMin} onChange={(e) => setDurationMin(Number(e.target.value))} aria-label="Exam duration">
              {DURATION_MINUTES.map((d) => <option key={d} value={d}>{d} min</option>)}
            </select>
          </label>
        )}
      </div>

      <Button size="sm" onClick={start} disabled={loading || (typeCounts ? (typeCounts[format] || 0) === 0 : false)}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
        {loading ? 'Starting…' : startLabel || (mode === 'practice' ? 'Start practice' : 'Start exam')}
      </Button>
      {error && <p className="text-xs text-rose-500">{error}</p>}
    </div>
  );
}
