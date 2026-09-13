'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, Send, ChevronLeft, ChevronRight, Check, LayoutGrid, Loader2, RefreshCw, LogOut, Cloud, CloudOff, Flame, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAttempt, type AttemptItem } from '@/lib/cbt/use-attempt';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'] as const;

function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

/** Timer urgency scales with remaining time, not a permanent red badge. */
function timerTone(remaining: number, durationSec: number | null): 'fg' | 'amber' | 'danger' {
  if (!durationSec) return 'amber';
  const ratio = remaining / durationSec;
  if (ratio > 0.5) return 'fg';
  if (ratio > 0.2) return 'amber';
  return 'danger';
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

  const countedRef = useRef<Set<string>>(new Set());
  const [practiceScore, setPracticeScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [justRevealed, setJustRevealed] = useState<{ itemId: string; correct: boolean } | null>(null);

  useEffect(() => {
    for (const it of items) {
      if (!it.revealed || countedRef.current.has(it.itemId)) continue;
      countedRef.current.add(it.itemId);
      if (it.gradeMethod === 'ungraded') continue;
      if (it.isCorrect) {
        setPracticeScore((s) => s + (it.awarded ?? it.points));
        setStreak((s) => s + 1);
      } else {
        setStreak(0);
      }
      setJustRevealed({ itemId: it.itemId, correct: !!it.isCorrect });
      const id = it.itemId;
      setTimeout(() => setJustRevealed((cur) => (cur?.itemId === id ? null : cur)), 500);
    }
  }, [items]);

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
      <div className="flex h-64 items-center justify-center bg-studio-bg">
        <Loader2 className="h-6 w-6 animate-spin text-studio-primary" />
      </div>
    );
  }

  if (error || !attempt) {
    return (
      <div className="min-h-dvh bg-studio-bg p-8">
        <div className="mx-auto max-w-md rounded-xl bg-studio-surface p-6 shadow-studio-border">
          <p className="text-sm text-studio-fg">{error || 'Could not load this attempt.'}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={reload} className="inline-flex h-10 items-center gap-2 rounded-full bg-studio-primary px-4 text-sm font-medium text-studio-primary-fg">
              <RefreshCw className="h-4 w-4" /> Retry
            </button>
            <button type="button" onClick={() => router.push('/cbt')} className="inline-flex h-10 items-center gap-2 rounded-full bg-studio-elevated px-4 text-sm font-medium text-studio-muted shadow-studio-border hover:text-studio-fg">
              Back to CBT
            </button>
          </div>
        </div>
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
    <div className="min-h-dvh bg-studio-bg pb-28 text-studio-fg lg:pb-4">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pb-6 pt-6 md:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3 studio-rise">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-studio-subtle">{isPractice ? 'Practice' : 'Exam'}</p>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-studio-muted">
              <span className="truncate">{attempt.sourceTitle ? `${attempt.sourceTitle} · ` : ''}{items.length} questions · {answeredCount} answered</span>
              {saveLabel && (
                <span className="inline-flex shrink-0 items-center gap-1 text-xs text-studio-subtle">
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
                  <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-studio-primary px-3 text-xs font-medium text-studio-primary-fg">
                    <Flame className="h-3.5 w-3.5" /> {streak} in a row
                  </span>
                )}
                <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-studio-elevated px-3 text-xs font-medium text-studio-muted shadow-studio-border">
                  <Star className="h-3.5 w-3.5" /> {practiceScore} pts
                </span>
              </>
            )}
            <button type="button" onClick={() => setShowNav((s) => !s)} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-studio-surface px-3 text-xs font-medium text-studio-muted shadow-studio-border hover:text-studio-fg">
              <LayoutGrid className="h-3.5 w-3.5" /> Questions
            </button>
            {!isPractice && remaining != null && (
              <span className={cn(
                'inline-flex h-9 items-center gap-1.5 rounded-full px-3 font-studio-mono text-sm tabular-nums',
                timerTone(remaining, attempt.durationSec) === 'fg' && 'bg-studio-elevated text-studio-fg',
                timerTone(remaining, attempt.durationSec) === 'amber' && 'bg-amber-500/15 text-amber-400',
                timerTone(remaining, attempt.durationSec) === 'danger' && 'bg-studio-danger/15 text-studio-danger',
                remaining <= 60 && 'animate-pulse',
              )}>
                <Clock className="h-3.5 w-3.5" /> {fmtTime(remaining)}
              </span>
            )}
            <button
              type="button"
              title="Abandon this attempt"
              onClick={() => { if (confirm('Abandon this attempt? Your progress will not be graded.')) abandon(); }}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-studio-subtle hover:bg-studio-elevated hover:text-studio-fg"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>

        {showNav && (
          <div className="rounded-xl bg-studio-surface p-4 shadow-studio-border">
            <div className="flex flex-wrap gap-2">
              {items.map((it, i) => (
                <button
                  key={it.itemId}
                  type="button"
                  onClick={() => { setCurrent(i); setShowNav(false); }}
                  className={cn('grid h-9 w-9 place-items-center rounded-lg text-xs font-medium transition-colors',
                    i === current ? 'bg-studio-primary text-studio-primary-fg'
                    : answered.has(it.itemId) ? 'bg-studio-elevated text-studio-fg shadow-studio-border'
                    : 'bg-studio-elevated/50 text-studio-subtle shadow-studio-border hover:text-studio-fg')}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="h-1 overflow-hidden rounded-full bg-studio-elevated">
          <div
            className="h-full rounded-full bg-studio-primary transition-[width] duration-300 ease-out"
            style={{ width: `${items.length ? (answeredCount / items.length) * 100 : 0}%` }}
          />
        </div>

        {!item ? (
          <div className="rounded-xl bg-studio-surface p-6 shadow-studio-border">
            <p className="text-sm text-studio-muted">No questions in this attempt.</p>
          </div>
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
          <button
            type="button"
            onClick={() => setCurrent((c) => Math.max(0, c - 1))}
            disabled={current === 0}
            className="inline-flex h-11 items-center gap-1.5 rounded-full bg-studio-surface px-4 text-sm font-medium text-studio-muted shadow-studio-border hover:text-studio-fg disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" /> Previous
          </button>
          {current < items.length - 1 ? (
            <button
              type="button"
              onClick={() => setCurrent((c) => Math.min(items.length - 1, c + 1))}
              className="inline-flex h-11 items-center gap-1.5 rounded-full bg-studio-primary px-5 text-sm font-medium text-studio-primary-fg"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <div className="hidden sm:block">
              <SubmitButton
                unansweredCount={unansweredCount}
                submitting={submitting}
                onClick={() => (unansweredCount > 0 ? setConfirmSubmit(true) : submit())}
              />
            </div>
          )}
        </div>
      </div>

      <div
        className="fixed inset-x-0 bottom-0 z-10 border-t border-studio-border bg-studio-bg/90 px-4 py-3 backdrop-blur-xl lg:hidden"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.75rem)' }}
      >
        <button
          type="button"
          onClick={() => (unansweredCount > 0 ? setConfirmSubmit(true) : submit())}
          disabled={submitting}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-studio-primary text-sm font-medium text-studio-primary-fg disabled:opacity-60"
        >
          <Send className="h-4 w-4" /> {submitting ? 'Submitting…' : `Submit answers (${answeredCount}/${items.length})`}
        </button>
      </div>

      {confirmSubmit && (
        <div className="fixed inset-0 z-20 grid place-items-center bg-studio-bg/70 p-4" onClick={() => setConfirmSubmit(false)}>
          <div className="w-full max-w-sm rounded-xl bg-studio-surface p-5 shadow-studio-float" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-studio-display text-xl tracking-tight text-studio-fg">Submit with {unansweredCount} unanswered?</h3>
            <p className="mt-2 text-sm leading-normal text-studio-muted">
              {unansweredCount} of {items.length} question{unansweredCount === 1 ? '' : 's'} still {unansweredCount === 1 ? 'has' : 'have'} no answer. Unanswered questions score zero.
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setConfirmSubmit(false)} className="h-10 w-full rounded-full bg-studio-elevated px-4 text-sm font-medium text-studio-muted hover:text-studio-fg sm:w-auto">
                Keep answering
              </button>
              <button
                type="button"
                onClick={() => { setConfirmSubmit(false); submit(); }}
                disabled={submitting}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-studio-primary px-4 text-sm font-medium text-studio-primary-fg sm:w-auto"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Submit anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SubmitButton({ unansweredCount, submitting, onClick }: { unansweredCount: number; submitting: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={submitting}
      className="inline-flex h-11 items-center gap-2 rounded-full bg-studio-primary px-5 text-sm font-medium text-studio-primary-fg disabled:opacity-60"
    >
      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
      {submitting ? 'Submitting…' : unansweredCount > 0 ? `Submit (${unansweredCount} unanswered)` : 'Submit answers'}
    </button>
  );
}

function QuestionCard({
  item, index, isPractice, checking, justRevealed, onAnswer, onCheck,
}: {
  item: AttemptItem;
  index: number;
  isPractice: boolean;
  checking: boolean;
  justRevealed: boolean | null;
  onAnswer: (v: string) => void;
  onCheck: () => void;
}) {
  const opts = item.options ?? [];
  const done = item.revealed;
  const selected = item.response ?? '';
  const isFreeText = opts.length === 0;
  const isFillBlank = item.type === 'FILL_BLANK';
  const wordCount = isFreeText && !isFillBlank ? (selected.trim() ? selected.trim().split(/\s+/).length : 0) : 0;

  return (
    <div key={item.itemId} className="rounded-xl bg-studio-surface p-6 shadow-studio-border studio-rise">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-studio-elevated px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-studio-subtle">{item.type}</span>
        <span className="text-xs text-studio-subtle">{item.points} pts</span>
        {isPractice && done && (
          item.gradeMethod === 'ungraded'
            ? <span className="inline-flex items-center gap-1 text-xs text-amber-400"><Clock className="h-3 w-3" /> Pending manual review</span>
            : item.isCorrect
              ? <span className="inline-flex items-center gap-1 text-xs text-studio-primary"><Check className="h-3 w-3" /> Correct{typeof item.awarded === 'number' && item.awarded > 0 && item.awarded < item.points ? ` (${item.awarded}/${item.points})` : ''}</span>
              : <span className="inline-flex items-center gap-1 text-xs text-studio-danger">{item.awarded ? `Partial (${item.awarded}/${item.points})` : 'Incorrect'}</span>
        )}
      </div>
      <h3 className="mt-4 font-studio-display text-2xl leading-snug tracking-tight text-studio-fg md:text-3xl">
        {index + 1}. {item.prompt}
      </h3>

      <div className="mt-6">
        {item.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.imageUrl} alt="Question illustration" className="mb-4 max-h-72 w-auto rounded-lg shadow-studio-border" />
        )}

        {!isFreeText ? (
          <div className="flex flex-col gap-2">
            {opts.map((opt, idx) => {
              const isAnswer = isPractice && done && item.correctAnswer != null && opt === item.correctAnswer;
              const isPicked = opt === selected;
              return (
                <button
                  key={idx}
                  type="button"
                  disabled={isPractice && done}
                  onClick={() => onAnswer(opt)}
                  className={cn(
                    'flex min-h-12 items-start gap-3 rounded-lg px-4 py-3 text-left text-sm leading-normal shadow-studio-border transition-colors',
                    isAnswer && 'bg-studio-primary text-studio-primary-fg',
                    isPractice && done && isPicked && !isAnswer && 'bg-studio-danger/15 text-studio-danger',
                    !done && isPicked && 'bg-studio-primary text-studio-primary-fg',
                    !isPicked && !isAnswer && 'bg-studio-elevated text-studio-fg hover:bg-studio-elevated/70',
                    done && !isAnswer && !isPicked && 'text-studio-muted',
                    justRevealed !== null && isPicked && (justRevealed ? 'animate-pulse' : ''),
                  )}
                >
                  <span className="mt-0.5 font-studio-mono text-xs opacity-70">{LETTERS[idx]}</span>
                  <span>{opt}</span>
                  {isAnswer && <Check className="ml-auto h-4 w-4 shrink-0" />}
                </button>
              );
            })}
          </div>
        ) : isFillBlank ? (
          <input
            type="text"
            className="h-12 w-full rounded-lg bg-studio-elevated px-4 text-sm text-studio-fg shadow-studio-border outline-none placeholder:text-studio-subtle disabled:opacity-70"
            placeholder="Type the missing word or phrase…"
            value={selected}
            disabled={isPractice && done}
            onChange={(e) => onAnswer(e.target.value)}
            autoComplete="off"
          />
        ) : (
          <div>
            <textarea
              className="min-h-32 w-full rounded-lg bg-studio-elevated px-4 py-3 text-sm text-studio-fg shadow-studio-border outline-none placeholder:text-studio-subtle disabled:opacity-70"
              placeholder="Type your answer…"
              value={selected}
              disabled={isPractice && done}
              onChange={(e) => onAnswer(e.target.value)}
            />
            <div className="mt-1 text-right text-xs text-studio-subtle">{wordCount} word{wordCount === 1 ? '' : 's'}</div>
          </div>
        )}

        {isPractice && done && (
          <div className="mt-4 rounded-lg bg-studio-elevated px-4 py-3 text-sm leading-normal text-studio-muted">
            <p><span className="text-studio-fg">Answer:</span> {item.correctAnswer || '—'}</p>
            {item.explanation && <p className="mt-2">{item.explanation}</p>}
            {item.feedback && <p className="mt-2 italic text-studio-subtle">{item.feedback}</p>}
          </div>
        )}
        {isPractice && !done && (
          <button
            type="button"
            onClick={onCheck}
            disabled={!selected.trim() || checking}
            className="mt-4 inline-flex h-10 items-center gap-2 rounded-full bg-studio-elevated px-4 text-sm font-medium text-studio-muted shadow-studio-border hover:text-studio-fg disabled:opacity-40"
          >
            {checking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Check answer
          </button>
        )}
      </div>
    </div>
  );
}
