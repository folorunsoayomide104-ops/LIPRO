'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { upload as blobUpload } from '@vercel/blob/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileUp, FileText, Loader2, Play, Zap, ListChecks, ToggleLeft, PenLine, NotebookPen, Sparkles } from 'lucide-react';
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

  // Starting from an already-uploaded document reuses whatever question(s)
  // were generated for it, regardless of the format picker above — that
  // picker controls what gets GENERATED for a fresh upload, and the
  // existing-documents list doesn't expose a per-format breakdown of what's
  // already saved, so filtering here could silently produce "no questions
  // available" for a document that has plenty, just not in this format.
  // THEORY is the one exception: documents can now have manually-authored
  // THEORY questions (QuestionManager's sourceId path) even while AI is
  // disabled, and those grade as "pending manual review" forever — no admin
  // screen exists yet to actually clear that queue. Excluded here so a
  // student can't land on one until that screen exists.
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

      // "analyzing" reflects what actually happens server-side now: the
      // document is scanned for exam-likely concepts before any question in
      // the chosen format is written, rather than pulling straight from
      // whatever text happens to fall in a chunk.
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

      <div>
        <label className="label flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-lipro-500" /> Question format</label>
        <div className="grid grid-cols-2 gap-2">
          {FORMAT_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const active = format === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFormat(opt.value)}
                disabled={phase !== 'idle'}
                className={`flex flex-col items-start gap-1 rounded-xl border p-2.5 text-left transition-all disabled:opacity-60 ${
                  active
                    ? 'border-lipro-500 bg-lipro-50 dark:border-lipro-400 dark:bg-lipro-950/50'
                    : 'border-lipro-200/60 hover:border-lipro-300 hover:bg-lipro-50/40 dark:border-lipro-500/20 dark:hover:bg-lipro-950/30'
                }`}
              >
                <span className={`flex items-center gap-1.5 text-sm font-medium ${active ? 'text-lipro-700 dark:text-lipro-200' : ''}`}>
                  <Icon className="h-4 w-4" /> {opt.label}
                </span>
                <span className="text-xs text-lipro-600/60 dark:text-lipro-300/60">{opt.hint}</span>
              </button>
            );
          })}
        </div>
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
          ? `We'll analyze your document for the concepts most likely to be tested, then write up to ${count} ${FORMAT_OPTIONS.find((f) => f.value === format)!.label.toLowerCase()} question(s) from them. Check each answer as you go — no timer, instant feedback, and a running score.`
          : `We'll analyze your document for the concepts most likely to be tested, then write up to ${count} ${FORMAT_OPTIONS.find((f) => f.value === format)!.label.toLowerCase()} question(s) and start a countdown timed exam. Auto-submits when time runs out.`}
      </p>

      {materials.length > 0 && (
        <div className="space-y-2 border-t border-lipro-200/40 pt-3">
          <div className="label">Your documents</div>
          {materials.map((m) => (
            <div key={m.id} className="rounded-xl p-2.5 glass-hover">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{m.originalName}</div>
                  <div className="text-xs text-lipro-600/60">{m.questionCount} questions</div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setManagingId((id) => (id === m.id ? null : m.id))}
                  >
                    {managingId === m.id ? 'Close' : 'Manage questions'}
                  </Button>
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
              </div>
              {managingId === m.id && (
                <div className="mt-3 border-t border-lipro-200/40 pt-3">
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
