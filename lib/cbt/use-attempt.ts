'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AUTOSAVE_DEBOUNCE_MS } from './constants';

export type AttemptItem = {
  itemId: string;
  orderIndex: number;
  type: string;
  prompt: string;
  options: string[] | null;
  imageUrl: string | null;
  points: number;
  response: string | null;
  revealed: boolean;
  correctAnswer?: string;
  explanation?: string | null;
  feedback?: string | null;
  isCorrect?: boolean | null;
  awarded?: number;
  gradeMethod?: string | null;
};

export type AttemptMeta = {
  id: string;
  mode: 'practice' | 'exam';
  status: string;
  sourceTitle: string;
  totalPoints: number;
  count: number;
  answeredCount: number;
  startedAt: string;
  deadlineAt: string | null;
  durationSec: number | null;
  gradingStatus: string;
};

type SaveState = 'idle' | 'saving' | 'saved' | 'error' | 'offline';

/**
 * Owns everything stateful about a running attempt: loading it from the
 * server, a wall-clock-correct countdown, debounced autosave, and submit.
 *
 * Nothing here touches sessionStorage — the attempt lives in the database, so
 * a refresh, a new tab, or a crash all just re-fetch the same state.
 */
export function useAttempt(attemptId: string) {
  const router = useRouter();
  const [attempt, setAttempt] = useState<AttemptMeta | null>(null);
  const [items, setItems] = useState<AttemptItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [submitting, setSubmitting] = useState(false);

  // deltaMs = local clock - server clock, so the countdown tracks real elapsed
  // time instead of drifting with a naive client-only interval.
  const clockOffsetRef = useRef(0);
  const deadlineRef = useRef<number | null>(null);
  const dirtyRef = useRef<Map<string, string | null>>(new Map());
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submittedRef = useRef(false);
  const submitRef = useRef<() => void>(() => {});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/cbt/attempts/${attemptId}`, { cache: 'no-store' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Could not load this attempt');

      if (data.redirect === 'results') {
        router.replace(`/cbt/${attemptId}/results`);
        return;
      }

      const serverNow = new Date(data.attempt.serverNow).getTime();
      clockOffsetRef.current = Date.now() - serverNow;
      deadlineRef.current = data.attempt.deadlineAt ? new Date(data.attempt.deadlineAt).getTime() : null;

      setAttempt(data.attempt);
      setItems(data.items);
      setRemaining(data.attempt.remainingSec ?? null);
    } catch (err: any) {
      setError(err?.message || 'Could not load this attempt');
    } finally {
      setLoading(false);
    }
  }, [attemptId, router]);

  useEffect(() => {
    load();
  }, [load]);

  // Countdown recomputed from the deadline every tick, and re-synced whenever
  // the tab regains focus — immune to background-tab throttling.
  useEffect(() => {
    if (!deadlineRef.current) return;
    const tick = () => {
      const localNow = Date.now() - clockOffsetRef.current;
      const left = Math.max(0, Math.round((deadlineRef.current! - localNow) / 1000));
      setRemaining(left);
      if (left <= 0) submitRef.current();
    };
    tick();
    const interval = setInterval(tick, 1000);
    const onVisible = () => document.visibilityState === 'visible' && tick();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', tick);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', tick);
    };
    // Deadline only changes on load(); items/attempt updates shouldn't restart the timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt?.deadlineAt]);

  const flush = useCallback(async (opts: { keepalive?: boolean } = {}) => {
    if (dirtyRef.current.size === 0 || submittedRef.current) return;
    const pending = Array.from(dirtyRef.current.entries()).map(([itemId, response]) => ({ itemId, response }));
    dirtyRef.current.clear();
    setSaveState('saving');
    try {
      const res = await fetch(`/api/cbt/attempts/${attemptId}/answers`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: pending }),
        keepalive: opts.keepalive,
      });
      if (res.status === 409) {
        const data = await res.json().catch(() => null);
        setSaveState('error');
        setAttempt((a) => (a ? { ...a, status: data?.status || 'completed' } : a));
        router.replace(`/cbt/${attemptId}/results`);
        return;
      }
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error();
      if (typeof data.remainingSec === 'number') {
        setRemaining(data.remainingSec);
        clockOffsetRef.current = Date.now() - new Date(data.serverNow).getTime();
      }
      setSaveState('saved');
    } catch {
      // Put the answers back so the next flush retries them.
      for (const { itemId, response } of pending) {
        if (!dirtyRef.current.has(itemId)) dirtyRef.current.set(itemId, response);
      }
      setSaveState('offline');
    }
  }, [attemptId, router]);

  const setAnswer = useCallback((itemId: string, response: string | null) => {
    setItems((prev) => prev.map((it) => (it.itemId === itemId ? { ...it, response } : it)));
    dirtyRef.current.set(itemId, response);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => flush(), AUTOSAVE_DEBOUNCE_MS);
  }, [flush]);

  // Flush on tab-hide / navigation-away so an answer typed seconds before a
  // close isn't lost waiting on the debounce.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush({ keepalive: true });
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('beforeunload', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('beforeunload', onHide);
    };
  }, [flush]);

  const submit = useCallback(async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSubmitting(true);
    try {
      const pending = Array.from(dirtyRef.current.entries()).map(([itemId, response]) => ({ itemId, response }));
      dirtyRef.current.clear();
      const res = await fetch(`/api/cbt/attempts/${attemptId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pending.length ? { items: pending } : {}),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Submit failed');
      // Fire-and-forget: grading runs server-side; the results page polls it.
      fetch(`/api/cbt/attempts/${attemptId}/grade`, { method: 'POST' }).catch(() => undefined);
      router.push(`/cbt/${attemptId}/results`);
    } catch (err: any) {
      submittedRef.current = false;
      setSubmitting(false);
      setError(err?.message || 'Submit failed. Check your connection and try again.');
    }
  }, [attemptId, router]);

  useEffect(() => {
    submitRef.current = submit;
  }, [submit]);

  const check = useCallback(async (itemId: string, response: string | null) => {
    const res = await fetch(`/api/cbt/attempts/${attemptId}/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId, response }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || 'Could not check this answer');
    setItems((prev) =>
      prev.map((it) =>
        it.itemId === itemId
          ? {
              ...it,
              response,
              revealed: true,
              correctAnswer: data.correctAnswer,
              explanation: data.explanation,
              feedback: data.feedback,
              isCorrect: data.isCorrect,
              awarded: data.awarded,
              gradeMethod: data.gradeMethod,
            }
          : it
      )
    );
    return data;
  }, [attemptId]);

  const abandon = useCallback(async () => {
    await fetch(`/api/cbt/attempts/${attemptId}`, { method: 'DELETE' }).catch(() => undefined);
    router.push('/cbt');
  }, [attemptId, router]);

  return { attempt, items, loading, error, remaining, saveState, submitting, setAnswer, submit, check, abandon, reload: load };
}
