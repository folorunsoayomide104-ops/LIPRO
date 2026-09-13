'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { upload as blobUpload } from '@vercel/blob/client';
import { FileUp, FileText, Loader2, Play, Zap, ListChecks, ToggleLeft, PenLine, NotebookPen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createAttempt } from '@/lib/cbt/client';
import { QUESTION_COUNTS, DURATION_MINUTES } from '@/lib/cbt/constants';
import type { QuestionFormat } from '@/lib/question-gen';
import { QuestionManager } from '@/components/cbt/question-manager';

type Doc = { id: string; originalName: string; sizeBytes: number; questionCount: number; createdAt: string };

const FORMAT_OPTIONS: Array<{ value: QuestionFormat; label: string; hint: string; icon: typeof ListChecks }> = [
  { value: 'MCQ', label: 'Multiple Choice', hint: '4 options, one correct answer', icon: ListChecks },
  { value: 'TRUE_FALSE', label: 'True / False', hint: 'Quick recall of key statements', icon: ToggleLeft },
  { value: 'FILL_BLANK', label: 'Fill in the Gap', hint: 'Recall exact terms and definitions', icon: PenLine },
  { value: 'THEORY', label: 'Theory / Essay', hint: 'Explain concepts in your own words', icon: NotebookPen },
];

export function PdfExamCreator({ materials }: { materials: Doc[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState<QuestionFormat>('MCQ');
  const [mode, setMode] = useState<'practice' | 'exam'>('practice');
  const [count, setCount] = useState(25);
  const [durationMin, setDurationMin] = useState(30);
  const [phase, setPhase] = useState<'idle' | 'uploading' | 'analyzing' | 'generating' | 'starting'>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [managingId, setManagingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const startExam = async (materialId: string, durationSec: number) => {
    const result = await createAttempt({
      source: { kind: 'material', id: materialId },
      mode,
      count,
      durationSec,
      types: ['MCQ', 'TRUE_FALSE', 'FILL_BLANK'],
    });
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

      setPhase('analyzing');
      setTimeout(() => setPhase((p) => (p === 'analyzing' ? 'generating' : p)), 1400);
      const gen = await fetch(`/api/materials/${materialId}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formats: [format], count, save: true }),
      });
      const genData = await gen.json().catch(() => null);
      if (!gen.ok) throw new Error(genData?.error || 'Question generation failed');

      setPhase('starting');
      const durationSec = durationMin * 60;
      const result = await createAttempt({ source: { kind: 'material', id: materialId }, mode, count, durationSec, types: [format] });
      router.push(`/cbt/${result.attemptId}`);
    } catch (err: any) {
      setError(err?.message || 'Something went wrong');
      setPhase('idle');
    }
  };

  const phaseText = phase === 'uploading' ? 'Uploading document…'
    : phase === 'analyzing' ? 'Analyzing document for exam-likely concepts…'
    : phase === 'generating' ? `Writing ${FORMAT_OPTIONS.find((f) => f.value === format)!.label.toLowerCase()} questions…`
    : phase === 'starting' ? (mode === 'practice' ? 'Starting practice…' : 'Starting timed exam…')
    : mode === 'practice' ? 'Analyze & start practice' : 'Analyze & start exam';

  const fmtBytes = (b: number) => (b > 1024 * 1024 ? `${(b / (1024 * 1024)).toFixed(1)} MB` : `${(b / 1024).toFixed(0)} KB`);

  return (
    <div className="flex flex-col gap-6">
      <div
        className="flex cursor-pointer flex-col items-center rounded-lg border border-dashed border-studio-border-strong px-4 py-8 text-center transition-colors hover:border-studio-primary/50 hover:bg-studio-bg/40"
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
          <>
            <FileText className="h-6 w-6 text-studio-primary" />
            <span className="mt-3 max-w-full truncate text-sm font-medium text-studio-fg">{file.name}</span>
            <span className="mt-1 text-xs text-studio-subtle">{fmtBytes(file.size)} · Selected</span>
          </>
        ) : (
          <>
            <FileUp className="h-6 w-6 text-studio-primary" />
            <span className="mt-3 text-sm font-medium text-studio-fg">Drop a PDF, Word, TXT or MD file here</span>
            <span className="mt-1 text-xs text-studio-subtle">Or click to choose</span>
          </>
        )}
      </div>

      <div>
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-studio-subtle">Question format</p>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {FORMAT_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const active = format === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFormat(opt.value)}
                disabled={phase !== 'idle'}
                className={cn(
                  'rounded-lg px-4 py-3 text-left shadow-studio-border transition-colors disabled:opacity-60',
                  active ? 'bg-studio-primary text-studio-primary-fg' : 'bg-studio-elevated text-studio-muted hover:text-studio-fg',
                )}
              >
                <span className="flex items-center gap-1.5 text-sm font-medium"><Icon className="h-4 w-4" /> {opt.label}</span>
                <span className={cn('mt-1 block text-xs', active ? 'text-studio-primary-fg/70' : 'text-studio-subtle')}>{opt.hint}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-studio-subtle">Sit as</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMode('practice')}
            className={cn('h-10 rounded-full text-sm font-medium transition-colors', mode === 'practice' ? 'bg-studio-primary text-studio-primary-fg' : 'bg-studio-elevated text-studio-muted shadow-studio-border hover:text-studio-fg')}
          >
            Practice
          </button>
          <button
            type="button"
            onClick={() => setMode('exam')}
            className={cn('h-10 rounded-full text-sm font-medium transition-colors', mode === 'exam' ? 'bg-studio-primary text-studio-primary-fg' : 'bg-studio-elevated text-studio-muted shadow-studio-border hover:text-studio-fg')}
          >
            Exam mode
          </button>
        </div>
      </div>

      <div className={cn('grid grid-cols-1 gap-3', mode === 'exam' && 'sm:grid-cols-2')}>
        <div>
          <label className="text-xs font-medium uppercase tracking-[0.16em] text-studio-subtle">Questions</label>
          <select
            className="mt-2 h-11 w-full rounded-lg bg-studio-elevated px-3 text-sm text-studio-fg shadow-studio-border outline-none"
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
          >
            {QUESTION_COUNTS.map((c) => <option key={c} value={c}>{c} questions</option>)}
          </select>
        </div>
        {mode === 'exam' && (
          <div>
            <label className="text-xs font-medium uppercase tracking-[0.16em] text-studio-subtle">Exam duration</label>
            <select
              className="mt-2 h-11 w-full rounded-lg bg-studio-elevated px-3 text-sm text-studio-fg shadow-studio-border outline-none"
              value={durationMin}
              onChange={(e) => setDurationMin(Number(e.target.value))}
            >
              {DURATION_MINUTES.map((d) => <option key={d} value={d}>{d} minutes</option>)}
            </select>
          </div>
        )}
      </div>

      <div>
        <button
          type="button"
          onClick={generateAndStart}
          disabled={phase !== 'idle'}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-studio-primary text-sm font-medium text-studio-primary-fg disabled:opacity-60"
        >
          {phase === 'idle' ? <Zap className="h-4 w-4" /> : <Loader2 className="h-4 w-4 animate-spin" />}
          {phaseText}
          {phase === 'uploading' && uploadProgress > 0 ? ` ${uploadProgress}%` : ''}
        </button>
        {phase === 'uploading' && (
          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-studio-elevated">
            <div className="h-full rounded-full bg-studio-primary transition-all" style={{ width: `${uploadProgress}%` }} />
          </div>
        )}
        {error && <p className="mt-2 text-xs text-studio-danger">{error}</p>}
        <p className="mt-3 text-xs leading-normal text-studio-subtle">
          {mode === 'practice'
            ? `We'll analyze your document for the concepts most likely to be tested, then write up to ${count} ${FORMAT_OPTIONS.find((f) => f.value === format)!.label.toLowerCase()} question(s) from them. Check each answer as you go — no timer, instant feedback, and a running score.`
            : `We'll analyze your document for the concepts most likely to be tested, then write up to ${count} ${FORMAT_OPTIONS.find((f) => f.value === format)!.label.toLowerCase()} question(s) and start a countdown timed exam. Auto-submits when time runs out.`}
        </p>
      </div>

      {materials.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-studio-border pt-4">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-studio-subtle">Your documents</p>
          {materials.map((m) => (
            <div key={m.id} className="rounded-lg bg-studio-elevated p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-studio-fg">{m.originalName}</div>
                  <div className="text-xs text-studio-subtle">{m.questionCount} questions</div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setManagingId((id) => (id === m.id ? null : m.id))}
                    className="h-8 rounded-full px-3 text-xs font-medium text-studio-subtle hover:text-studio-fg"
                  >
                    {managingId === m.id ? 'Close' : 'Manage questions'}
                  </button>
                  <button
                    type="button"
                    disabled={m.questionCount === 0 || phase !== 'idle'}
                    onClick={async () => {
                      setError('');
                      setPhase('starting');
                      try { await startExam(m.id, durationMin * 60); }
                      catch (err: any) { setError(err?.message || 'Could not start attempt'); setPhase('idle'); }
                    }}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full bg-studio-surface px-3 text-xs font-medium text-studio-muted shadow-studio-border hover:text-studio-fg disabled:opacity-40"
                  >
                    <Play className="h-3.5 w-3.5" /> {mode === 'practice' ? 'Practice' : 'Exam'}
                  </button>
                </div>
              </div>
              {managingId === m.id && (
                <div className="mt-3 border-t border-studio-border pt-3">
                  <QuestionManager sourceId={m.id} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
