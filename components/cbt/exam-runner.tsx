'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Send, ChevronLeft, ChevronRight, CheckCircle2, XCircle, LayoutGrid, Loader2, RefreshCw, LogOut, Cloud, CloudOff, Flame, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAttempt, type AttemptItem } from '@/lib/cbt/use-attempt';

function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

/** Timer urgency scales with remaining time, not a permanent red badge. */
function timerTone(remaining: number, durationSec: number | null): 'green' | 'amber' | 'rose' {
  if (!durationSec) return 'amber';
  const ratio = remaining / durationSec;
  if (ratio > 0.5) return 'green';
  if (ratio > 0.2) return 'amber';
  return 'rose';
}

export function ExamRunner({ attemptId }: { attemptId: string }) {
  const router = useRouter();
  const { attempt, items, loading, error, remaining, saveState, submitting, setAnswer, submit, check, abandon, reload } = useAttempt(attemptId);

  const [current, setCurrent] = useState(0);
  const [showNav, setShowNav] = useState(false);
  const [checking, setChecking] = useState<string | null>(null);
  const [confirmSubmit, setConfirmSubmit] = useState(false);

  const answeredCount = useMemo(() => items.filter((i) => (i.response ?? '').trim().length > 0).length, [items]);
  const unansweredCount = items.length - answeredCount;

  // Practice-mode running score/streak — purely a motivational UI layer
  // derived from data useAttempt already provides (item.revealed/isCorrect),
  // no grading logic touched. A ref tracks which items have already been
  // counted so re-renders (or checking questions out of order via the nav
  // grid) never double-count or misattribute a streak to array position.
  const countedRef = useRef<Set<string>>(new Set());
  const [practiceScore, setPracticeScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [justRevealed, setJustRevealed] = useState<{ itemId: string; correct: boolean } | null>(null);

  useEffect(() => {
    for (const it of items) {
      if (!it.revealed || countedRef.current.has(it.itemId)) continue;
      countedRef.current.add(it.itemId);
      if (it.isCorrect) {
        setPracticeScore((s) => s + (it.awarded ?? it.points));
        setStreak((s) => {
          const next = s + 1;
          setBestStreak((b) => Math.max(b, next));
          return next;
        });
      } else {
        setStreak(0);
      }
      setJustRevealed({ itemId: it.itemId, correct: !!it.isCorrect });
      // Clear after the animation window so revisiting this question later
      // (via Previous/Next or the nav grid) doesn't replay the reveal
      // animation — it should only play at the moment of the real event.
      const id = it.itemId;
      setTimeout(() => setJustRevealed((cur) => (cur?.itemId === id ? null : cur)), 500);
    }
  }, [items]);

  const parseOptions = useCallback((item: AttemptItem): string[] => item.options ?? [], []);

  const doCheck = async (item: AttemptItem) => {
    setChecking(item.itemId);
    try {
      await check(item.itemId, item.response ?? '');
    } catch {
      // check() already surfaces nothing fatal — a failed check just leaves the item unrevealed.
    } finally {
      setChecking(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-lipro-500" />
      </div>
    );
  }

  if (error || !attempt) {
    return (
      <div className="p-8">
        <Card>
          <CardContent>
            <p className="text-sm">{error || 'Could not load this attempt.'}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button onClick={reload}><RefreshCw className="h-4 w-4" /> Retry</Button>
              <Button variant="outline" onClick={() => router.push('/cbt')}>Back to CBT</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isPractice = attempt.mode === 'practice';
  const item = items[current];
  const answered = new Set(items.filter((i) => (i.response ?? '').trim()).map((i) => i.itemId));

  const saveLabel =
    saveState === 'saving' ? 'Saving…' :
    saveState === 'saved' ? 'Saved' :
    saveState === 'offline' ? 'Offline — retrying' :
    saveState === 'error' ? 'Could not save' : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">{isPractice ? 'Practice' : 'Exam'} mode</h2>
          <p className="flex flex-wrap items-center gap-x-2 text-xs text-lipro-600/60">
            <span className="truncate">{attempt.sourceTitle ? `${attempt.sourceTitle} · ` : ''}{items.length} questions · {answeredCount} answered</span>
            {saveLabel && (
              <span className="inline-flex shrink-0 items-center gap-1">
                {saveState === 'offline' || saveState === 'error' ? <CloudOff className="h-3 w-3" /> : <Cloud className="h-3 w-3" />}
                {saveLabel}
              </span>
            )}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {isPractice && (
            <>
              {streak >= 2 && (
                <Badge tone="amber" className="cbt-pop-in">
                  <Flame className="h-3 w-3" /> {streak} in a row
                </Badge>
              )}
              <Badge tone="purple">
                <Star className="h-3 w-3" /> {practiceScore} pts
              </Badge>
            </>
          )}
          <Button size="sm" variant="outline" onClick={() => setShowNav((s) => !s)}><LayoutGrid className="h-4 w-4" /> Questions</Button>
          {!isPractice && remaining != null && (
            <Badge tone={timerTone(remaining, attempt.durationSec)} className={cn('shrink-0 text-sm', remaining <= 60 && 'animate-pulse')}>
              <Clock className="h-3 w-3" /> {fmtTime(remaining)}
            </Badge>
          )}
          <Button
            size="sm"
            variant="ghost"
            title="Abandon this attempt"
            onClick={() => {
              if (confirm('Abandon this attempt? Your progress will not be graded.')) abandon();
            }}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {showNav && (
        <Card>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {items.map((it, i) => (
                <button
                  key={it.itemId}
                  type="button"
                  onClick={() => { setCurrent(i); setShowNav(false); }}
                  className={cn('grid h-9 w-9 place-items-center rounded-lg border text-xs font-medium transition-all',
                    i === current ? 'border-lipro-500 bg-lipro-600 text-white'
                    : answered.has(it.itemId) ? 'border-green-400/60 bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-300'
                    : 'border-lipro-200/60 text-lipro-600/70 hover:bg-lipro-50 dark:border-lipro-700/40 dark:text-lipro-200/70')}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="h-1.5 overflow-hidden rounded-full bg-lipro-100/60 dark:bg-lipro-900/40">
        <div
          className="h-full rounded-full bg-gradient-to-r from-lipro-500 to-lipro-400 transition-all duration-500 ease-out"
          style={{ width: `${items.length ? (answeredCount / items.length) * 100 : 0}%` }}
        />
      </div>

      {!item ? (
        <Card><CardContent><p className="text-sm text-lipro-600/70">No questions in this attempt.</p></CardContent></Card>
      ) : (
        <QuestionCard
          item={item}
          index={current}
          isPractice={isPractice}
          checking={checking === item.itemId}
          justRevealed={justRevealed?.itemId === item.itemId ? justRevealed.correct : null}
          onAnswer={(v) => setAnswer(item.itemId, v)}
          onCheck={() => doCheck(item)}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="outline" onClick={() => setCurrent((c) => Math.max(0, c - 1))} disabled={current === 0}>
          <ChevronLeft className="h-4 w-4" /> Previous
        </Button>
        {current < items.length - 1 ? (
          <Button onClick={() => setCurrent((c) => Math.min(items.length - 1, c + 1))}>Next <ChevronRight className="h-4 w-4" /></Button>
        ) : (
          <SubmitControl
            unansweredCount={unansweredCount}
            confirmOpen={confirmSubmit}
            submitting={submitting}
            onRequestSubmit={() => (unansweredCount > 0 ? setConfirmSubmit(true) : submit())}
            onConfirm={() => { setConfirmSubmit(false); submit(); }}
            onCancel={() => setConfirmSubmit(false)}
          />
        )}
      </div>

      <div
        className="lg:hidden sticky bottom-0 z-10 -mx-4 mt-6 border-t border-lipro-100/60 bg-[rgb(var(--bg))]/90 px-4 py-3 backdrop-blur-xl dark:border-lipro-500/10"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.75rem)' }}
      >
        <Button
          onClick={() => (unansweredCount > 0 ? setConfirmSubmit(true) : submit())}
          disabled={submitting}
          size="lg"
          className="w-full"
        >
          <Send className="h-4 w-4" /> {submitting ? 'Submitting…' : `Submit answers (${answeredCount}/${items.length})`}
        </Button>
      </div>

      {confirmSubmit && (
        <div className="fixed inset-0 z-20 grid place-items-center bg-black/40 p-4" onClick={() => setConfirmSubmit(false)}>
          <Card className="max-w-sm" onClick={(e) => e.stopPropagation()}>
            <CardHeader><h3 className="text-base font-semibold">Submit with {unansweredCount} unanswered?</h3></CardHeader>
            <CardContent>
              <p className="text-sm text-lipro-600/70">
                {unansweredCount} of {items.length} question{unansweredCount === 1 ? '' : 's'} still {unansweredCount === 1 ? 'has' : 'have'} no answer. Unanswered questions score zero.
              </p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button variant="outline" className="w-full sm:w-auto" onClick={() => setConfirmSubmit(false)}>Keep answering</Button>
                <Button className="w-full sm:w-auto" onClick={() => { setConfirmSubmit(false); submit(); }} disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Submit anyway
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function SubmitControl(props: {
  unansweredCount: number;
  confirmOpen: boolean;
  submitting: boolean;
  onRequestSubmit: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { unansweredCount, submitting, onRequestSubmit } = props;
  return (
    <Button onClick={onRequestSubmit} disabled={submitting}>
      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
      {submitting ? 'Submitting…' : unansweredCount > 0 ? `Submit (${unansweredCount} unanswered)` : 'Submit answers'}
    </Button>
  );
}

function QuestionCard({
  item, index, isPractice, checking, justRevealed, onAnswer, onCheck,
}: {
  item: AttemptItem;
  index: number;
  isPractice: boolean;
  checking: boolean;
  /** true/false right as this item's check result lands, null once the reveal moment has passed. */
  justRevealed: boolean | null;
  onAnswer: (v: string) => void;
  onCheck: () => void;
}) {
  const opts = item.options ?? [];
  const done = item.revealed;
  const selected = item.response ?? '';
  const isFreeText = opts.length === 0;
  // FILL_BLANK is graded by exact text match against a single word/short
  // phrase (lib/cbt/grading.ts) — a multi-line essay box with a word count
  // (the THEORY treatment) invites a full sentence that can never match,
  // so a conceptually correct answer gets marked wrong. Give it its own
  // compact single-line input instead.
  const isFillBlank = item.type === 'FILL_BLANK';
  const wordCount = isFreeText && !isFillBlank ? (selected.trim() ? selected.trim().split(/\s+/).length : 0) : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="amber">{item.type}</Badge>
          <span className="text-xs">{item.points} pts</span>
          {isPractice && done && (
            item.isCorrect
              ? <Badge tone="green"><CheckCircle2 className="h-3 w-3" /> Correct{typeof item.awarded === 'number' && item.awarded > 0 && item.awarded < item.points ? ` (${item.awarded}/${item.points})` : ''}</Badge>
              : <Badge tone="rose"><XCircle className="h-3 w-3" /> {item.awarded ? `Partial (${item.awarded}/${item.points})` : 'Incorrect'}</Badge>
          )}
        </div>
        <h3 className="mt-2 text-base font-medium">{index + 1}. {item.prompt}</h3>
      </CardHeader>
      <CardContent>
        {item.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.imageUrl} alt="Question illustration" className="mb-3 max-h-72 w-auto rounded-xl border border-lipro-200/50 object-contain dark:border-lipro-700/40" />
        )}

        {!isFreeText ? (
          <div className="space-y-2">
            {opts.map((opt, idx) => {
              const isAnswer = isPractice && done && item.correctAnswer != null && opt === item.correctAnswer;
              const isPicked = opt === selected;
              return (
                <label
                  key={idx}
                  className={cn(
                    'tap flex items-center gap-3 rounded-xl border p-3.5 cursor-pointer transition-all',
                    isPractice && done && isAnswer ? 'border-green-400/70 bg-green-50/70 dark:bg-green-950/30'
                    : isPractice && done && isPicked && !isAnswer ? 'border-rose-400/70 bg-rose-50/70 dark:bg-rose-950/30'
                    : 'border-lipro-200/50 hover:bg-lipro-50/50 dark:border-lipro-700/40 dark:hover:bg-lipro-950/30',
                    justRevealed !== null && isPicked && (justRevealed ? 'cbt-pulse-correct' : 'cbt-shake-wrong')
                  )}
                >
                  <input
                    type="radio"
                    name={item.itemId}
                    value={opt}
                    checked={isPicked}
                    disabled={isPractice && done}
                    onChange={(e) => onAnswer(e.target.value)}
                    className="h-5 w-5 shrink-0 accent-lipro-600"
                  />
                  <span className="text-sm leading-snug">{opt}</span>
                  {isPractice && done && isAnswer && <CheckCircle2 className="ml-auto h-4 w-4 shrink-0 text-green-500" />}
                </label>
              );
            })}
          </div>
        ) : isFillBlank ? (
          <input
            type="text"
            className="input"
            placeholder="Type the missing word or phrase…"
            value={selected}
            disabled={isPractice && done}
            onChange={(e) => onAnswer(e.target.value)}
            autoComplete="off"
          />
        ) : (
          <div>
            <textarea
              className="input min-h-24"
              placeholder="Type your answer…"
              value={selected}
              disabled={isPractice && done}
              onChange={(e) => onAnswer(e.target.value)}
            />
            <div className="mt-1 text-right text-xs text-lipro-600/50">{wordCount} word{wordCount === 1 ? '' : 's'}</div>
          </div>
        )}

        {isPractice && done && (
          <div className="mt-3 rounded-xl border border-lipro-200/50 bg-lipro-50/40 p-3 text-xs dark:border-lipro-700/40 dark:bg-lipro-950/30">
            <div><strong>Answer:</strong> {item.correctAnswer || '—'}</div>
            {item.explanation && <p className="mt-1 text-lipro-600/80 dark:text-lipro-200/70">{item.explanation}</p>}
            {item.feedback && <p className="mt-1 italic text-lipro-600/70 dark:text-lipro-200/60">{item.feedback}</p>}
          </div>
        )}
        {isPractice && !done && (
          <Button size="sm" variant="outline" className="mt-3" onClick={onCheck} disabled={!selected.trim() || checking}>
            {checking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Check answer
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
