'use client';
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Send, ChevronLeft, ChevronRight, CheckCircle2, XCircle, LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';

type Q = { id: string; type: string; question: string; options: string | null; imageUrl: string | null; points: number; answer?: string; explanation?: string | null };

export function ExamRunner({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const search = useSearchParams();
  const mode = (search.get('mode') as 'practice' | 'exam') || 'exam';
  const stored = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return JSON.parse(sessionStorage.getItem('cbt_session') || 'null');
  }, []);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const remainingSec = mode === 'exam' && stored?.durationSec ? stored.durationSec : 0;
  const [timeLeft, setTimeLeft] = useState(remainingSec);
  const questions: Q[] = stored?.questions || [];
  const [current, setCurrent] = useState(0);
  const [showNav, setShowNav] = useState(false);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const answersRef = useRef<Record<string, string>>(answers);
  const submittedRef = useRef(false);
  const submitRef = useRef<() => void>(() => {});

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  const parseOptions = useCallback((s: string | null): string[] => {
    if (!s) return [];
    try {
      const v = JSON.parse(s);
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  }, []);

  const submit = useCallback(async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    try {
      const res = await fetch('/api/cbt/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId, answers: answersRef.current }) });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setResult(data);
        sessionStorage.removeItem('cbt_session');
      } else {
        submittedRef.current = false;
        alert(data?.error || 'Submit failed');
      }
    } catch {
      submittedRef.current = false;
      alert('Submit failed. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }, [sessionId]);

  useEffect(() => {
    submitRef.current = submit;
  }, [submit]);

  useEffect(() => {
    if (mode !== 'exam' || !remainingSec || submittedRef.current) return;
    const t = setInterval(() => {
      setTimeLeft((s) => {
        if (s <= 1) {
          clearInterval(t);
          submitRef.current();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [mode, remainingSec]);

  if (!stored) return (
    <div className="p-8">
      <Card><CardContent><p className="text-sm">Session not found. Please start again from the CBT page.</p>
      <Button className="mt-3" onClick={() => router.push('/cbt')}>Back to CBT</Button></CardContent></Card>
    </div>
  );

  if (result) return (
    <div className="space-y-4">
      <Card>
        <CardHeader><h3 className="text-lg font-semibold">Session result — {result.percentage}%</h3><p className="text-sm text-lipro-600/70">Score: {result.score} / {result.totalPoints} points</p></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {result.breakdown?.map((b: any, i: number) => (
              <div key={i} className="rounded-xl p-3 glass-hover">
                <div className="flex items-center gap-2"><Badge tone={b.isCorrect ? 'green' : 'rose'}>{b.isCorrect ? 'Correct' : 'Incorrect'}</Badge><span className="text-xs">{b.points} pts</span></div>
                <div className="mt-1 text-sm">{b.question}</div>
                <div className="mt-2 text-xs"><div><strong>Your answer:</strong> {b.yourAnswer || '—'}</div><div className="mt-1"><strong>Correct:</strong> {b.correctAnswer || '—'}</div></div>
                {b.explanation && <p className="mt-2 text-xs text-lipro-600/70 dark:text-lipro-200/70">{b.explanation}</p>}
              </div>
            ))}
          </div>
          <Button className="mt-4" onClick={() => router.push('/cbt')}>Back to CBT</Button>
        </CardContent>
      </Card>
    </div>
  );

  const fmt = (s: number) => `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`;
  const answeredCount = Object.keys(answers).length;

  const markChecked = (qid: string) => {
    setChecked((c) => ({ ...c, [qid]: true }));
  };

  const renderQuestion = (q: Q, index: number) => {
    const opts = parseOptions(q.options);
    const isPractice = mode === 'practice';
    const done = checked[q.id];
    const selected = answers[q.id];
    const isCorrect = isPractice && done && q.answer != null && selected === q.answer;

    return (
      <Card key={q.id}>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Badge tone="amber">{q.type}</Badge>
            <span className="text-xs">{q.points} pts</span>
            {isPractice && done && (isCorrect
              ? <Badge tone="green"><CheckCircle2 className="h-3 w-3" /> Correct</Badge>
              : <Badge tone="rose"><XCircle className="h-3 w-3" /> Incorrect</Badge>)}
          </div>
          <h3 className="text-base mt-2 font-medium">{index + 1}. {q.question}</h3>
        </CardHeader>
        <CardContent>
          {opts.length > 0 ? (
            <div className="space-y-2">
              {opts.map((opt: string, idx: number) => {
                const isAnswer = isPractice && done && q.answer != null && opt === q.answer;
                const isPicked = opt === selected;
                return (
                  <label key={idx} className={cn('tap flex items-center gap-3 rounded-xl border p-3.5 cursor-pointer transition-all',
                    isPractice && done && isAnswer ? 'border-green-400/70 bg-green-50/70 dark:bg-green-950/30'
                    : isPractice && done && isPicked && !isAnswer ? 'border-rose-400/70 bg-rose-50/70 dark:bg-rose-950/30'
                    : 'border-lipro-200/50 hover:bg-lipro-50/50 dark:border-lipro-700/40 dark:hover:bg-lipro-950/30')}>
                    <input type="radio" name={q.id} value={opt} checked={isPicked} disabled={isPractice && done} onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))} className="h-5 w-5 shrink-0 accent-lipro-600" />
                    <span className="text-sm leading-snug">{opt}</span>
                    {isPractice && done && isAnswer && <CheckCircle2 className="ml-auto h-4 w-4 shrink-0 text-green-500" />}
                  </label>
                );
              })}
            </div>
          ) : (
            <textarea
              className="input min-h-24"
              placeholder="Type your answer…"
              value={answers[q.id] || ''}
              disabled={isPractice && done}
              onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
            />
          )}

          {isPractice && done && (
            <div className="mt-3 rounded-xl border border-lipro-200/50 bg-lipro-50/40 p-3 text-xs dark:border-lipro-700/40 dark:bg-lipro-950/30">
              <div><strong>Answer:</strong> {q.answer || '—'}</div>
              {q.explanation && <p className="mt-1 text-lipro-600/80 dark:text-lipro-200/70">{q.explanation}</p>}
            </div>
          )}
          {isPractice && !done && (
            <Button size="sm" variant="outline" className="mt-3" onClick={() => markChecked(q.id)} disabled={!selected}>
              Check answer
            </Button>
          )}
        </CardContent>
      </Card>
    );
  };

  const answered = new Set(Object.keys(answers));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{mode === 'exam' ? 'Exam' : 'Practice'} mode</h2>
          <p className="text-xs text-lipro-600/60">{stored.sourceTitle ? `${stored.sourceTitle} · ` : ''}{questions.length} questions · {answeredCount} answered</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowNav((s) => !s)}><LayoutGrid className="h-4 w-4" /> Questions</Button>
          {mode === 'exam' && <Badge tone="rose" className="text-sm"><Clock className="h-3 w-3" /> {fmt(timeLeft)}</Badge>}
        </div>
      </div>

      {showNav && (
        <Card>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {questions.map((q, i) => (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => { setCurrent(i); setShowNav(false); }}
                  className={cn('grid h-9 w-9 place-items-center rounded-lg border text-xs font-medium transition-all',
                    i === current ? 'border-lipro-500 bg-lipro-600 text-white'
                    : answered.has(q.id) ? 'border-green-400/60 bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-300'
                    : 'border-lipro-200/60 text-lipro-600/70 hover:bg-lipro-50 dark:border-lipro-700/40 dark:text-lipro-200/70')}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {renderQuestion(questions[current], current)}

      <div className="flex items-center justify-between gap-3">
        <Button variant="outline" onClick={() => setCurrent((c) => Math.max(0, c - 1))} disabled={current === 0}><ChevronLeft className="h-4 w-4" /> Previous</Button>
        {current < questions.length - 1 ? (
          <Button onClick={() => setCurrent((c) => Math.min(questions.length - 1, c + 1))}>Next <ChevronRight className="h-4 w-4" /></Button>
        ) : (
          <Button onClick={submit} disabled={submitting}><Send className="h-4 w-4" /> {submitting ? 'Submitting…' : 'Submit answers'}</Button>
        )}
      </div>

      <div className="lg:hidden sticky bottom-0 z-10 -mx-4 mt-6 border-t border-lipro-100/60 bg-[rgb(var(--bg))]/90 px-4 py-3 backdrop-blur-xl dark:border-lipro-500/10" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.75rem)' }}>
        <Button onClick={submit} disabled={submitting} size="lg" className="w-full"><Send className="h-4 w-4" /> {submitting ? 'Submitting…' : `Submit answers (${answeredCount}/${questions.length})`}</Button>
      </div>
      <div className="hidden lg:block">
        <Button onClick={submit} disabled={submitting} size="lg"><Send className="h-4 w-4" /> {submitting ? 'Submitting…' : `Submit answers (${answeredCount}/${questions.length})`}</Button>
      </div>
    </div>
  );
}
