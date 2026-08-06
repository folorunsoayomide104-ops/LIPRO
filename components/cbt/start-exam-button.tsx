'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Brain, Loader2, Timer, ListChecks } from 'lucide-react';

const COUNTS = [10, 25, 50, 100];
const DURATIONS = [10, 15, 30, 60];

export function StartExamButton({ courseId }: { courseId: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<'practice' | 'exam'>('practice');
  const [count, setCount] = useState(10);
  const [durationMin, setDurationMin] = useState(15);
  const [loading, setLoading] = useState(false);

  const start = async () => {
    setLoading(true);
    const res = await fetch('/api/cbt/exam', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseId, mode, count, durationSec: durationMin * 60 }),
    });
    const data = await res.json().catch(() => null);
    setLoading(false);
    if (!res.ok) { alert(data?.error || 'Could not start'); return; }
    sessionStorage.setItem('cbt_session', JSON.stringify(data));
    router.push(`/cbt/${data.sessionId}?mode=${mode}`);
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

      <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1.5">
        <label className="flex items-center gap-1.5 text-xs text-lipro-600/80 dark:text-lipro-200/70">
          <ListChecks className="h-3.5 w-3.5" />
          <select className="input !py-1 text-xs" value={count} onChange={(e) => setCount(Number(e.target.value))} aria-label="Number of questions">
            {COUNTS.map((c) => <option key={c} value={c}>{c} questions</option>)}
          </select>
        </label>
        {mode === 'exam' && (
          <label className="flex items-center gap-1.5 text-xs text-lipro-600/80 dark:text-lipro-200/70">
            <Timer className="h-3.5 w-3.5" />
            <select className="input !py-1 text-xs" value={durationMin} onChange={(e) => setDurationMin(Number(e.target.value))} aria-label="Exam duration">
              {DURATIONS.map((d) => <option key={d} value={d}>{d} min</option>)}
            </select>
          </label>
        )}
      </div>

      <Button size="sm" onClick={start} disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
        {loading ? 'Starting…' : mode === 'practice' ? 'Start practice' : 'Start exam'}
      </Button>
    </div>
  );
}
