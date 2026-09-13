'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Brain, Loader2, Timer, ListChecks } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createAttempt, type AttemptSource } from '@/lib/cbt/client';
import { QUESTION_COUNTS, DURATION_MINUTES } from '@/lib/cbt/constants';
import { FORMAT_LABELS, type QuestionFormat } from '@/lib/question-gen';

// THEORY/ESSAY excluded from selection while AI grading is disabled
// (lib/ai.ts's AI_FEATURES_ENABLED) — a student starting a session with
// this format would land on questions that grade as "pending manual
// review" forever, since there's no admin screen yet to actually grade
// them. Manually-authored THEORY questions still exist in the bank; they're
// just not offered as a startable format right now.
const ALL_FORMATS: QuestionFormat[] = ['MCQ', 'TRUE_FALSE', 'FILL_BLANK'];

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
      <div className="flex gap-1 rounded-full bg-studio-elevated p-1 shadow-studio-border">
        <button
          type="button"
          onClick={() => setMode('practice')}
          className={cn('rounded-full px-3 py-1.5 text-xs font-medium transition-colors', mode === 'practice' ? 'bg-studio-primary text-studio-primary-fg' : 'text-studio-muted hover:text-studio-fg')}
        >
          Practice
        </button>
        <button
          type="button"
          onClick={() => setMode('exam')}
          className={cn('rounded-full px-3 py-1.5 text-xs font-medium transition-colors', mode === 'exam' ? 'bg-studio-primary text-studio-primary-fg' : 'text-studio-muted hover:text-studio-fg')}
        >
          Exam mode
        </button>
      </div>

      {typeCounts && (
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
              return <option key={f} value={f} disabled={n === 0}>{FORMAT_LABELS[f]} ({n})</option>;
            })}
          </select>
        </label>
      )}

      <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1.5">
        <label className="flex items-center gap-1.5 text-xs text-studio-muted">
          <ListChecks className="h-3.5 w-3.5" />
          <select
            className="h-8 rounded-md bg-studio-elevated px-2 text-xs text-studio-fg shadow-studio-border outline-none"
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            aria-label="Number of questions"
          >
            {QUESTION_COUNTS.map((c) => <option key={c} value={c}>{c} questions</option>)}
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
              {DURATION_MINUTES.map((d) => <option key={d} value={d}>{d} min</option>)}
            </select>
          </label>
        )}
      </div>

      <button
        type="button"
        onClick={start}
        disabled={loading || (typeCounts ? (typeCounts[format] || 0) === 0 : false)}
        className="inline-flex h-9 items-center gap-1.5 rounded-full bg-studio-primary px-4 text-xs font-medium text-studio-primary-fg disabled:opacity-50"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
        {loading ? 'Starting…' : startLabel || (mode === 'practice' ? 'Start practice' : 'Start exam')}
      </button>
      {error && <p className="text-xs text-studio-danger">{error}</p>}
    </div>
  );
}
