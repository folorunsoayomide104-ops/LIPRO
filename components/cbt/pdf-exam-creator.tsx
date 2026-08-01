'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileUp, FileText, Loader2, Play, Zap } from 'lucide-react';

type Doc = { id: string; originalName: string; sizeBytes: number; questionCount: number; createdAt: string };

const COUNTS = [10, 25, 50];
const DURATIONS = [15, 30, 60];

export function PdfExamCreator({ materials }: { materials: Doc[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [count, setCount] = useState(25);
  const [durationMin, setDurationMin] = useState(30);
  const [phase, setPhase] = useState<'idle' | 'uploading' | 'generating' | 'starting'>('idle');
  const [error, setError] = useState('');

  const startExam = async (materialId: string, durationSec: number) => {
    const res = await fetch('/api/cbt/exam', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ materialId, mode: 'exam', count, durationSec }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || 'Could not start exam');
    sessionStorage.setItem('cbt_session', JSON.stringify(data));
    router.push(`/cbt/${data.sessionId}?mode=exam`);
  };

  const generateAndStart = async () => {
    if (!file) { setError('Choose a document first'); return; }
    setError('');
    setPhase('uploading');
    let materialId = '';
    try {
      const fd = new FormData();
      fd.append('file', file);
      const up = await fetch('/api/materials', { method: 'POST', body: fd });
      const upData = await up.json().catch(() => null);
      if (!up.ok) throw new Error(upData?.error || 'Upload failed');
      materialId = upData.material.id;

      setPhase('generating');
      const gen = await fetch(`/api/materials/${materialId}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formats: ['MCQ', 'TRUE_FALSE', 'FILL_BLANK', 'THEORY'], count: Math.ceil(count / 4), save: true }),
      });
      const genData = await gen.json().catch(() => null);
      if (!gen.ok) throw new Error(genData?.error || 'Question generation failed');

      setPhase('starting');
      await startExam(materialId, durationMin * 60);
    } catch (err: any) {
      setError(err?.message || 'Something went wrong');
      setPhase('idle');
    }
  };

  const phaseText = phase === 'uploading' ? 'Uploading document…'
    : phase === 'generating' ? 'Generating questions (can take a minute)…'
    : phase === 'starting' ? 'Starting timed exam…'
    : 'Generate & start exam';

  const fmtBytes = (b: number) => (b > 1024 * 1024 ? `${(b / (1024 * 1024)).toFixed(1)} MB` : `${(b / 1024).toFixed(0)} KB`);

  return (
    <div className="space-y-4">
      <div
        className="cursor-pointer rounded-xl border border-dashed border-lipro-300/50 p-4 text-center transition-colors hover:border-lipro-400 hover:bg-lipro-50/40 dark:hover:bg-lipro-950/30"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f) setFile(f);
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.txt,.md,.markdown"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
        {file ? (
          <div className="flex items-center justify-center gap-2 text-sm font-medium">
            <FileText className="h-4 w-4 text-lipro-500" /> {file.name}
            <span className="text-xs text-lipro-600/60">({fmtBytes(file.size)})</span>
            <Badge tone="green">Selected</Badge>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 text-sm text-lipro-600/70">
            <FileUp className="h-4 w-4" /> Drop a PDF, TXT or MD here, or click to choose
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Questions</label>
          <select className="input" value={count} onChange={(e) => setCount(Number(e.target.value))}>
            {COUNTS.map((c) => <option key={c} value={c}>{c} questions</option>)}
          </select>
        </div>
        <div>
          <label className="label">Exam duration</label>
          <select className="input" value={durationMin} onChange={(e) => setDurationMin(Number(e.target.value))}>
            {DURATIONS.map((d) => <option key={d} value={d}>{d} minutes</option>)}
          </select>
        </div>
      </div>

      <Button onClick={generateAndStart} disabled={phase !== 'idle'} className="w-full" size="lg">
        {phase === 'idle' ? <Zap className="h-4 w-4" /> : <Loader2 className="h-4 w-4 animate-spin" />}
        {phaseText}
      </Button>
      {error && <p className="text-xs text-rose-500">{error}</p>}
      <p className="text-xs text-lipro-600/60">Generates up to {count} questions from your document and starts a countdown timed exam. Auto-submits when time runs out.</p>

      {materials.length > 0 && (
        <div className="space-y-2 border-t border-lipro-200/40 pt-3">
          <div className="label">Your documents</div>
          {materials.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-2 rounded-xl p-2.5 glass-hover">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{m.originalName}</div>
                <div className="text-xs text-lipro-600/60">{m.questionCount} questions</div>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={m.questionCount === 0 || phase !== 'idle'}
                onClick={async () => {
                  setError('');
                  setPhase('starting');
                  try { await startExam(m.id, durationMin * 60); }
                  catch (err: any) { setError(err?.message || 'Could not start exam'); setPhase('idle'); }
                }}
              >
                <Play className="h-3.5 w-3.5" /> Exam
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
