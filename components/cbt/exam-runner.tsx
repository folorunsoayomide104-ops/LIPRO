'use client';
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Send } from 'lucide-react';

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h2 className="text-lg font-semibold">{mode === 'exam' ? 'Exam' : 'Practice'} mode</h2><p className="text-xs text-lipro-600/60">{stored.sourceTitle ? `${stored.sourceTitle} · ` : ''}{questions.length} questions</p></div>
        {mode === 'exam' && <Badge tone="rose" className="text-sm"><Clock className="h-3 w-3" /> {fmt(timeLeft)}</Badge>}
      </div>
      {questions.map((q, i) => {
        const opts = parseOptions(q.options);
        return (
          <Card key={q.id}>
            <CardHeader><div className="flex items-center gap-2"><Badge tone="amber">{q.type}</Badge><span className="text-xs">{q.points} pts</span></div><h3 className="text-base mt-2 font-medium">{i+1}. {q.question}</h3></CardHeader>
            <CardContent>
              {opts.length > 0 ? (
                <div className="space-y-2">
                  {opts.map((opt: string, idx: number) => (
                    <label key={idx} className="tap flex items-center gap-3 rounded-xl border border-lipro-200/50 p-3.5 hover:bg-lipro-50/50 dark:border-lipro-700/40 dark:hover:bg-lipro-950/30 cursor-pointer">
                      <input type="radio" name={q.id} value={opt} checked={answers[q.id] === opt} onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))} className="h-5 w-5 shrink-0 accent-lipro-600" />
                      <span className="text-sm leading-snug">{opt}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <textarea className="input min-h-24" placeholder="Type your answer…" value={answers[q.id] || ''} onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))} />
              )}
              {mode === 'practice' && q.answer && (
                <p className="mt-2 text-xs text-lipro-600/70 dark:text-lipro-200/70"><strong>Answer:</strong> {q.answer}</p>
              )}
            </CardContent>
          </Card>
        );
      })}
      <div className="lg:hidden sticky bottom-0 z-10 -mx-4 mt-6 border-t border-lipro-100/60 bg-[rgb(var(--bg))]/90 px-4 py-3 backdrop-blur-xl dark:border-lipro-500/10" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.75rem)' }}>
        <Button onClick={submit} disabled={submitting} size="lg" className="w-full"><Send className="h-4 w-4" /> {submitting ? 'Submitting…' : 'Submit answers'}</Button>
      </div>
      <div className="hidden lg:block">
        <Button onClick={submit} disabled={submitting} size="lg"><Send className="h-4 w-4" /> {submitting ? 'Submitting…' : 'Submit answers'}</Button>
      </div>
    </div>
  );
}
