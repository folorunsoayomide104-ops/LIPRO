'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Loader2, Sparkles, AlertTriangle, Pencil } from 'lucide-react';
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

function scoreTone(pct: number): 'green' | 'amber' | 'rose' {
  if (pct >= 70) return 'green';
  if (pct >= 40) return 'amber';
  return 'rose';
}

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
      <Card>
        <CardContent>
          <p className="text-sm">{error}</p>
          <Button className="mt-3" onClick={() => router.push('/cbt')}>Back to CBT</Button>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-lipro-500" />
      </div>
    );
  }

  const { attempt, items } = data;
  const grading = attempt.gradingStatus === 'pending' || attempt.gradingStatus === 'grading';

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>{attempt.sourceTitle} — {attempt.percentage}%</CardTitle>
            <p className="text-sm text-lipro-600/70">
              Score: {attempt.score} / {attempt.totalPoints} points
              {attempt.autoSubmitted && ' · Auto-submitted when time ran out'}
              {attempt.student && ` · ${attempt.student.name}`}
            </p>
          </div>
          <Badge tone={scoreTone(attempt.percentage)} className="text-sm">{attempt.percentage}%</Badge>
        </CardHeader>
        <CardContent>
          {attempt.legacy && (
            <div className="mb-3 flex items-center gap-2 rounded-xl border border-amber-300/50 bg-amber-50/60 p-3 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/20 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4 shrink-0" /> This is an older attempt with limited detail — no AI feedback is available for it.
            </div>
          )}
          {grading && (
            <div className="mb-3 flex items-center gap-2 rounded-xl border border-lipro-300/50 bg-lipro-50/60 p-3 text-xs text-lipro-700 dark:border-lipro-500/30 dark:bg-lipro-950/20 dark:text-lipro-200">
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> Grading your written answers…
            </div>
          )}
          {attempt.gradingStatus === 'degraded' && (
            <div className="mb-3 flex items-center gap-2 rounded-xl border border-amber-300/50 bg-amber-50/60 p-3 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/20 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4 shrink-0" /> Written answers were graded with a fallback estimator (AI grading was unavailable). Scores for those questions are approximate.
            </div>
          )}
          {attempt.aiFeedback && (
            <div className="mb-3 flex items-start gap-2 rounded-xl border border-lipro-300/50 bg-lipro-50/60 p-3 text-xs text-lipro-700 dark:border-lipro-500/30 dark:bg-lipro-950/20 dark:text-lipro-200">
              <Sparkles className="h-4 w-4 shrink-0" /> {attempt.aiFeedback}
            </div>
          )}

          <div className="space-y-3">
            {items.map((item) => (
              <ReviewCard key={item.itemId} item={item} attemptId={attemptId} canOverride={attempt.canOverride} onOverridden={load} />
            ))}
          </div>

          <Button className="mt-4" onClick={() => router.push('/cbt')}>Back to CBT</Button>
        </CardContent>
      </Card>
    </div>
  );
}

function ReviewCard({
  item, attemptId, canOverride, onOverridden,
}: {
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
    <div className="rounded-xl p-3 glass-hover">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={item.isCorrect ? 'green' : item.awarded > 0 ? 'amber' : 'rose'}>
          {item.isCorrect ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
          {item.isCorrect ? 'Correct' : item.awarded > 0 ? 'Partial credit' : 'Incorrect'}
        </Badge>
        <span className="text-xs">{item.awarded} / {item.points} pts</span>
        {item.gradeMethod && (
          <span className={cn('text-[11px] font-medium', item.overridden ? 'text-lipro-600' : 'text-lipro-500/70')}>
            {GRADE_LABEL[item.gradeMethod] ?? item.gradeMethod}
          </span>
        )}
        {!item.isGraded && <span className="text-[11px] text-lipro-500/70">Grading…</span>}
        {canOverride && (
          <button type="button" className="ml-auto text-lipro-500 hover:text-lipro-700" onClick={() => setEditing((e) => !e)} title="Override grade">
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="mt-1 text-sm">{item.prompt}</div>
      <div className="mt-2 text-xs">
        <div><strong>Your answer:</strong> {item.response || '—'}</div>
        <div className="mt-1"><strong>Correct:</strong> {item.correctAnswer || '—'}</div>
      </div>
      {item.explanation && <p className="mt-2 text-xs text-lipro-600/70 dark:text-lipro-200/70">{item.explanation}</p>}
      {item.feedback && <p className="mt-1 text-xs italic text-lipro-600/70 dark:text-lipro-200/60">{item.feedback}</p>}
      {item.overridden && item.overrideNote && (
        <p className="mt-1 text-xs text-lipro-600/70 dark:text-lipro-200/60"><strong>Lecturer note:</strong> {item.overrideNote}</p>
      )}

      {editing && (
        <div className="mt-3 flex flex-wrap items-end gap-2 rounded-xl border border-lipro-200/50 p-3 dark:border-lipro-700/40">
          <label className="text-xs">
            <div className="mb-1 text-lipro-600/70">Award (max {item.points})</div>
            <input
              type="number"
              min={0}
              max={item.points}
              step={0.5}
              value={awarded}
              onChange={(e) => setAwarded(Math.min(item.points, Math.max(0, Number(e.target.value))))}
              className="input !w-24 !py-1"
            />
          </label>
          <label className="flex-1 text-xs">
            <div className="mb-1 text-lipro-600/70">Note (optional)</div>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} className="input !py-1" />
          </label>
          <Button size="sm" onClick={submitOverride} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Save
          </Button>
        </div>
      )}
    </div>
  );
}
