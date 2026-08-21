'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { upload as blobUpload } from '@vercel/blob/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileUp, FileText, Loader2, Play, Zap } from 'lucide-react';
import { createAttempt } from '@/lib/cbt/client';
import { QUESTION_COUNTS, DURATION_MINUTES } from '@/lib/cbt/constants';

type Doc = { id: string; originalName: string; sizeBytes: number; questionCount: number; createdAt: string };

export function PdfExamCreator({ materials }: { materials: Doc[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<'practice' | 'exam'>('practice');
  const [count, setCount] = useState(25);
  const [durationMin, setDurationMin] = useState(30);
  const [phase, setPhase] = useState<'idle' | 'uploading' | 'generating' | 'starting'>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');

  const startExam = async (materialId: string, durationSec: number) => {
    const result = await createAttempt({ source: { kind: 'material', id: materialId }, mode, count, durationSec });
    router.push(`/cbt/${result.attemptId}`);
  };

  const generateAndStart = async () => {
    if (!file) { setError('Choose a document first'); return; }
    setError('');
    setPhase('uploading');
    let materialId = '';
    try {
      const blob = await blobUpload(file.name, file, {
        access: 'public',
        handleUploadUrl: '/api/materials/upload',
        clientPayload: JSON.stringify({ sizeBytes: file.size }),
        multipart: file.size > 50 * 1024 * 1024,
        onUploadProgress: (p) => setUploadProgress(p.percentage),
      });

      const up = await fetch('/api/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blobUrl: blob.url,
          originalName: file.name,
          sizeBytes: file.size,
          mimeType: file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'text/plain'),
        }),
      });
      const upData = await up.json().catch(() => null);
      if (!up.ok) throw new Error(upData?.error || 'Upload failed');
      materialId = upData.material.id;

      setPhase('generating');
      const gen = await fetch(`/api/materials/${materialId}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formats: ['MCQ'], count, save: true }),
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
    : phase === 'starting' ? (mode === 'practice' ? 'Starting practice…' : 'Starting timed exam…')
    : mode === 'practice' ? 'Generate & start practice' : 'Generate & start exam';

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
          accept="application/pdf,.docx,text/plain,text/markdown"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
        {file ? (
          <div className="flex flex-wrap items-center justify-center gap-2 text-sm font-medium">
            <FileText className="h-4 w-4 shrink-0 text-lipro-500" />
            <span className="max-w-full truncate">{file.name}</span>
            <span className="shrink-0 text-xs text-lipro-600/60">({fmtBytes(file.size)})</span>
            <Badge tone="green" className="shrink-0">Selected</Badge>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 text-sm text-lipro-600/70">
            <FileUp className="h-4 w-4" /> Drop a PDF, Word, TXT or MD file here, or click to choose
          </div>
        )}
      </div>

      <div className="flex gap-1 rounded-xl border border-lipro-200/60 bg-lipro-50/50 p-1 dark:border-lipro-500/20 dark:bg-lipro-950/30">
        <button
          type="button"
          onClick={() => setMode('practice')}
          className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${mode === 'practice' ? 'bg-lipro-600 text-white shadow-sm' : 'text-lipro-600/80 hover:bg-lipro-100/60 dark:text-lipro-200/70'}`}
        >
          Practice
        </button>
        <button
          type="button"
          onClick={() => setMode('exam')}
          className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${mode === 'exam' ? 'bg-lipro-600 text-white shadow-sm' : 'text-lipro-600/80 hover:bg-lipro-100/60 dark:text-lipro-200/70'}`}
        >
          Exam mode
        </button>
      </div>

      <div className={`grid grid-cols-1 gap-3 ${mode === 'exam' ? 'sm:grid-cols-2' : ''}`}>
        <div>
          <label className="label">Questions</label>
          <select className="input" value={count} onChange={(e) => setCount(Number(e.target.value))}>
            {QUESTION_COUNTS.map((c) => <option key={c} value={c}>{c} questions</option>)}
          </select>
        </div>
        {mode === 'exam' && (
          <div>
            <label className="label">Exam duration</label>
            <select className="input" value={durationMin} onChange={(e) => setDurationMin(Number(e.target.value))}>
              {DURATION_MINUTES.map((d) => <option key={d} value={d}>{d} minutes</option>)}
            </select>
          </div>
        )}
      </div>

      <Button onClick={generateAndStart} disabled={phase !== 'idle'} className="w-full" size="lg">
        {phase === 'idle' ? <Zap className="h-4 w-4" /> : <Loader2 className="h-4 w-4 animate-spin" />}
        {phaseText}
        {phase === 'uploading' && uploadProgress > 0 ? ` ${uploadProgress}%` : ''}
      </Button>
      {phase === 'uploading' && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-lipro-100 dark:bg-white/10">
          <div className="h-full rounded-full bg-lipro-500 transition-all" style={{ width: `${uploadProgress}%` }} />
        </div>
      )}
      {error && <p className="text-xs text-rose-500">{error}</p>}
      <p className="text-xs text-lipro-600/60">
        {mode === 'practice'
          ? `Generates up to ${count} questions from your document. Check each answer as you go — no timer, instant feedback, and a running score.`
          : `Generates up to ${count} questions from your document and starts a countdown timed exam. Auto-submits when time runs out.`}
      </p>

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
                  catch (err: any) { setError(err?.message || 'Could not start attempt'); setPhase('idle'); }
                }}
              >
                <Play className="h-3.5 w-3.5" /> {mode === 'practice' ? 'Practice' : 'Exam'}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
