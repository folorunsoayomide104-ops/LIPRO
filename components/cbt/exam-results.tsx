'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X, Loader2, Sparkles, AlertTriangle, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';

type ReviewItem = {
  itemId: string;
  orderIndex: number;
  type: string;
  prompt: string;
  options: string[] | null;
  imageUrl: string | null;
  points: number;
  response: string | null;
  correctAnswer: string;
  explanation: string | null;
  feedback: string | null;
  isCorrect: boolean | null;
  awarded: number;
  isGraded: boolean;
  gradeMethod: string | null;
  confidence: number | null;
  overridden: boolean;
  overrideNote: string | null;
};

type ResultsData = {
  attempt: {
    id: string;
    mode: string;
    status: string;
    sourceTitle: string;
    score: number;
    totalPoints: number;
    percentage: number;
    completedAt: string | null;
    autoSubmitted: boolean;
    gradingStatus: string;
    aiFeedback: string | null;
    legacy: boolean;
    canOverride: boolean;
    student: { id: string; name: string } | null;
  };
  items: ReviewItem[];
};

const GRADE_LABEL: Record<string, string> = {
  exact: 'Auto-graded',
  ai: 'AI-graded',
  heuristic: 'Estimated',
  override: 'Lecturer-graded',
};

export function ExamResults({ attemptId }: { attemptId: string }) {
  const router = useRouter();
  const [data, setData] = useState<ResultsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const gradeTriggered = useRef(false);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = async () => {
    try {
      const res = await fetch(`/api/cbt/attempts/${attemptId}/results`, { cache: 'no-store' });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || 'Could not load results');
      setData(json);
      return json as ResultsData;
    } catch (err: any) {
      setError(err?.message || 'Could not load results');
      return null;
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const first = await load();
      if (cancelled || !first) return;

      const isGrading = ['pending', 'grading'].includes(first.attempt.gradingStatus);
      if (isGrading && !gradeTriggered.current) {
        gradeTriggered.current = true;
        fetch(`/api/cbt/attempts/${attemptId}/grade`, { method: 'POST' }).catch(() => undefined);
      }
      if (isGrading) {
        pollRef.current = setInterval(async () => {
          const latest = await load();
          if (latest && !['pending', 'grading'].includes(latest.attempt.gradingStatus) && pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
        }, 3000);
      }
    })();
    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId]);

  if (error) {
    return (
      <div className="min-h-dvh bg-studio-bg p-8">
        <div className="mx-auto max-w-md rounded-xl bg-studio-surface p-6 shadow-studio-border">
          <p className="text-sm text-studio-fg">{error}</p>
          <button type="button" onClick={() => router.push('/cbt')} className="mt-4 inline-flex h-10 items-center rounded-full bg-studio-primary px-4 text-sm font-medium text-studio-primary-fg">
            Back to CBT
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-64 items-center justify-center bg-studio-bg">
        <Loader2 className="h-6 w-6 animate-spin text-studio-primary" />
      </div>
    );
  }

  const { attempt, items } = data;
  const grading = attempt.gradingStatus === 'pending' || attempt.gradingStatus === 'grading';

  return (
    <div className="min-h-dvh bg-studio-bg text-studio-fg">
      <div className="mx-auto flex w-full max-w-3xl flex-col px-4 pb-12 pt-6 md:px-8">
        <header className="mb-8 studio-rise">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-studio-subtle">Review</p>
          <h2 className="mt-2 break-words font-studio-display text-3xl tracking-tight md:text-4xl">
            {attempt.sourceTitle} — {attempt.percentage}%
          </h2>
          <p className="mt-3 text-sm leading-normal text-studio-muted">
            Score: {attempt.score} / {attempt.totalPoints} points
            {attempt.autoSubmitted && ' · Auto-submitted when time ran out'}
            {attempt.student && ` · ${attempt.student.name}`}
          </p>

          {attempt.legacy && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-amber-500/10 px-4 py-3 text-xs text-amber-400">
              <AlertTriangle className="h-4 w-4 shrink-0" /> This is an older attempt with limited detail — no AI feedback is available for it.
            </div>
          )}
          {grading && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-studio-elevated px-4 py-3 text-xs text-studio-muted shadow-studio-border">
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> Grading your written answers…
            </div>
          )}
          {attempt.gradingStatus === 'degraded' && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-amber-500/10 px-4 py-3 text-xs text-amber-400">
              <AlertTriangle className="h-4 w-4 shrink-0" /> Written answers were graded with a fallback estimator (AI grading was unavailable). Scores for those questions are approximate.
            </div>
          )}
          {attempt.aiFeedback && (
            <div className="mt-4 flex items-start gap-2 rounded-lg bg-studio-primary/10 px-4 py-3 text-xs leading-relaxed text-studio-fg">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-studio-primary" /> {attempt.aiFeedback}
            </div>
          )}

          <button type="button" onClick={() => router.push('/cbt')} className="mt-6 inline-flex h-10 items-center rounded-full bg-studio-elevated px-4 text-sm font-medium text-studio-muted shadow-studio-border hover:text-studio-fg">
            Back to CBT
          </button>
        </header>

        <ol className="flex flex-col gap-4">
          {items.map((item, i) => (
            <ReviewCard key={item.itemId} index={i} item={item} attemptId={attemptId} canOverride={attempt.canOverride} onOverridden={load} />
          ))}
        </ol>
      </div>
    </div>
  );
}

function ReviewCard({
  index, item, attemptId, canOverride, onOverridden,
}: {
  index: number;
  item: ReviewItem;
  attemptId: string;
  canOverride: boolean;
  onOverridden: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [awarded, setAwarded] = useState(item.awarded);
  const [note, setNote] = useState(item.overrideNote ?? '');
  const [saving, setSaving] = useState(false);

  const submitOverride = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/cbt/attempts/${attemptId}/items/${item.itemId}/override`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ awarded, note: note || null }),
      });
      if (!res.ok) throw new Error();
      setEditing(false);
      onOverridden();
    } catch {
      // Leave the form open so the lecturer can retry.
    } finally {
      setSaving(false);
    }
  };

  return (
    <li className="rounded-xl bg-studio-surface p-5 shadow-studio-border">
      <p className="flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-studio-subtle">
        <span>{index + 1}</span>
        <span className={cn(item.isCorrect ? 'text-studio-primary' : item.awarded > 0 ? 'text-amber-400' : 'text-studio-danger')}>
          {item.isCorrect ? <Check className="inline h-3 w-3" /> : <X className="inline h-3 w-3" />}{' '}
          {item.isCorrect ? 'Correct' : item.awarded > 0 ? 'Partial credit' : 'Incorrect'}
        </span>
        <span className="normal-case tracking-normal text-studio-subtle">· {item.awarded} / {item.points} pts</span>
        {item.gradeMethod && (
          <span className="normal-case tracking-normal text-studio-subtle">· {GRADE_LABEL[item.gradeMethod] ?? item.gradeMethod}</span>
        )}
        {!item.isGraded && <span className="normal-case tracking-normal text-studio-subtle">· Grading…</span>}
        {canOverride && (
          <button type="button" className="ml-auto text-studio-subtle hover:text-studio-fg" onClick={() => setEditing((e) => !e)} title="Override grade">
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </p>
      <p className="mt-2 text-sm leading-normal text-studio-fg">{item.prompt}</p>
      <div className="mt-3 space-y-1.5 text-sm text-studio-muted">
        <p>Your answer: <span className="text-studio-fg">{item.response || '—'}</span></p>
        <p>Correct: <span className="text-studio-fg">{item.correctAnswer || '—'}</span></p>
      </div>
      {item.explanation ? (
        <p className="mt-3 flex gap-2 text-sm leading-normal text-studio-muted">
          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-studio-primary" /> {item.explanation}
        </p>
      ) : null}
      {item.feedback && <p className="mt-2 text-sm italic text-studio-subtle">{item.feedback}</p>}
      {item.overridden && item.overrideNote && (
        <p className="mt-2 text-sm text-studio-subtle">Lecturer note: {item.overrideNote}</p>
      )}

      {editing && (
        <div className="mt-4 flex flex-wrap items-end gap-3 rounded-lg bg-studio-elevated p-3">
          <label className="text-xs text-studio-subtle">
            <div className="mb-1">Award (max {item.points})</div>
            <input
              type="number"
              min={0}
              max={item.points}
              step={0.5}
              value={awarded}
              onChange={(e) => setAwarded(Math.min(item.points, Math.max(0, Number(e.target.value))))}
              className="h-9 w-24 rounded-md bg-studio-surface px-2 text-sm text-studio-fg shadow-studio-border outline-none"
            />
          </label>
          <label className="flex-1 text-xs text-studio-subtle">
            <div className="mb-1">Note (optional)</div>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="h-9 w-full rounded-md bg-studio-surface px-3 text-sm text-studio-fg shadow-studio-border outline-none"
            />
          </label>
          <button
            type="button"
            onClick={submitOverride}
            disabled={saving}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-studio-primary px-4 text-xs font-medium text-studio-primary-fg disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Save
          </button>
        </div>
      )}
    </li>
  );
}
