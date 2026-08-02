'use client';
import { useState } from 'react';
import { upload as blobUpload } from '@vercel/blob/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, UploadCloud, Sparkles, Loader2, Trash2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { LiproLogo } from '@/components/LiproLogo';
import AmbientBackground from '@/components/dashboard/ambient-bg';
import { cn } from '@/lib/utils';
import { FORMAT_LABELS, type QuestionFormat } from '@/lib/question-gen';

type Material = {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  status: string;
  createdAt: string;
  questionCount: number;
};
type GeneratedQ = {
  type: QuestionFormat;
  question: string;
  options: string[] | null;
  answer: string;
  explanation: string;
};

const FORMATS: QuestionFormat[] = ['MCQ', 'TRUE_FALSE', 'FILL_BLANK', 'THEORY'];

const FORMAT_TONE: Record<QuestionFormat, 'purple' | 'indigo' | 'green' | 'amber'> = {
  MCQ: 'purple',
  TRUE_FALSE: 'indigo',
  FILL_BLANK: 'green',
  THEORY: 'amber',
};

const PRESETS = [
  { label: '10 questions', count: 10 },
  { label: '25 questions', count: 25 },
  { label: '50 questions', count: 50 },
  { label: '75 questions', count: 75 },
  { label: '100 questions', count: 100 },
];

export function PdfIntelligence({ initialMaterials }: { initialMaterials: Material[] }) {
  const [materials, setMaterials] = useState<Material[]>(initialMaterials);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  const [activeMaterial, setActiveMaterial] = useState<Material | null>(null);
  const [formats, setFormats] = useState<QuestionFormat[]>(FORMATS);
  const [target, setTarget] = useState(50);
  const [save, setSave] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState<GeneratedQ[] | null>(null);
  const [usedFallback, setUsedFallback] = useState(false);
  const [generationError, setGenerationError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const formatBytes = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${(n / 1024).toFixed(0)} KB`);

  const upload = async () => {
    if (!file) { setError('Choose a file first.'); return; }
    setUploading(true); setError('');
    try {
      const blob = await blobUpload(file.name, file, {
        access: 'public',
        handleUploadUrl: '/api/materials/upload',
        clientPayload: JSON.stringify({ sizeBytes: file.size }),
        multipart: file.size > 50 * 1024 * 1024,
        onUploadProgress: (p) => setProgress(p.percentage),
      });

      const res = await fetch('/api/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blobUrl: blob.url,
          originalName: file.name,
          sizeBytes: file.size,
          mimeType: file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'text/plain'),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Upload failed');
      setMaterials((m) => [data.material, ...m]);
      setFile(null);
      if (data.material) setActiveMaterial(data.material);
    } catch (e: any) {
      setError(e?.message || 'Upload failed');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const generate = async () => {
    if (!activeMaterial) return;
    if (formats.length === 0) { setGenerationError('Select at least one format.'); return; }
    const count = Math.max(1, Math.ceil(target / formats.length));
    setGenerating(true); setResults(null); setGenerationError(''); setUsedFallback(false);
    try {
      const res = await fetch(`/api/materials/${activeMaterial.id}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formats, count, save }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Generation failed');
      setResults(data.questions || []);
      setUsedFallback(!!data.usedFallback);
      if (data.saved) {
        setMaterials((m) => m.map((x) => (x.id === activeMaterial.id ? { ...x, questionCount: x.questionCount + (data.questions?.length || 0) } : x)));
      }
    } catch (e: any) {
      setGenerationError(e?.message || 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const removeMaterial = async (id: string) => {
    setDeletingId(id);
    try {
      await fetch(`/api/materials/${id}`, { method: 'DELETE' });
      setMaterials((m) => m.filter((x) => x.id !== id));
      if (activeMaterial?.id === id) { setActiveMaterial(null); setResults(null); }
    } finally {
      setDeletingId(null);
    }
  };

  const toggleFormat = (f: QuestionFormat) => {
    setFormats((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));
  };

  return (
    <div className="relative overflow-hidden">
      <AmbientBackground variant="mesh" />
      <div className="relative space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><LiproLogo className="h-6 w-6" /> PDF Intelligence</h1>
        <p className="text-sm text-lipro-600/70 dark:text-lipro-200/70">Upload any PDF and generate accurate CBT questions in multiple formats.</p>
      </div>

      <Card>
        <CardHeader>
          <div><CardTitle className="flex items-center gap-2"><UploadCloud className="h-5 w-5 text-lipro-500" /> Upload a document</CardTitle><CardDescription className="mt-1">PDF, TXT or Markdown up to 100MB. Text is extracted automatically.</CardDescription></div>
        </CardHeader>
        <CardContent>
          <div>
            <Label>File</Label>
            <input
              type="file"
              accept=".pdf,.txt,.md,.markdown,.csv,application/pdf,text/plain,text/markdown"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full rounded-xl border border-dashed border-lipro-300/50 bg-white/50 px-4 py-2.5 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-lipro-600 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white dark:bg-surface-dark/40"
            />
          </div>
          {error && <p className="mt-3 text-sm text-rose-500">{error}</p>}
          {file && <p className="mt-3 text-xs text-lipro-600/70 dark:text-lipro-200/70">Selected: <span className="font-medium">{file.name}</span> ({formatBytes(file.size)})</p>}
          <Button onClick={upload} disabled={uploading} className="mt-4">
            {uploading ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading… {progress > 0 ? `${progress}%` : ''}</> : <><UploadCloud className="h-4 w-4" /> Upload document</>}
          </Button>
          {uploading && (
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-lipro-100 dark:bg-white/10">
              <div className="h-full rounded-full bg-lipro-500 transition-all" style={{ width: `${progress}%` }} />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">My documents ({materials.length})</h2>
          {materials.length === 0 && <p className="text-sm text-lipro-600/60">No documents yet. Upload your first PDF above.</p>}
          {materials.map((m) => (
            <div key={m.id} className={cn('flex items-center gap-3 rounded-2xl border p-4 transition-all', activeMaterial?.id === m.id ? 'glass border-lipro-400/60' : 'glass-hover')}>
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-lipro-500/20 to-lipro-700/20 text-lipro-600 dark:text-lipro-300">
                <FileText className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{m.originalName}</div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-lipro-600/70 dark:text-lipro-200/70">
                  <span>{formatBytes(m.sizeBytes)}</span>
                  <span>·</span>
                  <span>{m.questionCount} question{m.questionCount === 1 ? '' : 's'}</span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => { setActiveMaterial(m); setResults(null); }}>Generate</Button>
                <button onClick={() => removeMaterial(m.id)} disabled={deletingId === m.id} className="rounded-lg p-2 text-lipro-400 transition-all hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-950/30" title="Delete">
                  {deletingId === m.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">Generate questions</h2>
          {!activeMaterial ? (
            <p className="text-sm text-lipro-600/60">Select a document on the left to generate questions from it.</p>
          ) : (
            <Card>
              <CardHeader>
                <div><CardTitle className="text-base">{activeMaterial.originalName}</CardTitle><CardDescription className="mt-1">{formatBytes(activeMaterial.sizeBytes)} · {activeMaterial.questionCount} saved question{activeMaterial.questionCount === 1 ? '' : 's'}</CardDescription></div>
              </CardHeader>
              <CardContent>
                <div>
                  <Label>Formats</Label>
                  <div className="flex flex-wrap gap-2">
                    {FORMATS.map((f) => (
                      <button key={f} type="button" onClick={() => toggleFormat(f)} className={cn('rounded-full border px-3 py-1.5 text-xs font-medium transition-all', formats.includes(f) ? 'border-lipro-500 bg-lipro-600 text-white' : 'border-lipro-300/40 text-lipro-600/80 hover:bg-lipro-50 dark:text-lipro-200/80 dark:hover:bg-lipro-950/40')}>
                        {FORMAT_LABELS[f]}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mt-4">
                  <Label>How many questions?</Label>
                  <div className="flex flex-wrap gap-2">
                    {PRESETS.map((p) => (
                      <button key={p.count} type="button" onClick={() => setTarget(p.count)} className={cn('rounded-full border px-3 py-1.5 text-xs font-medium transition-all', target === p.count ? 'border-lipro-500 bg-lipro-600 text-white' : 'border-lipro-300/40 text-lipro-600/80 hover:bg-lipro-50 dark:text-lipro-200/80 dark:hover:bg-lipro-950/40')}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-lipro-600/60 dark:text-lipro-200/50">~{Math.max(1, Math.ceil(target / formats.length))} per format × {formats.length} format{formats.length === 1 ? '' : 's'}. The AI reads the document in sections for accuracy.</p>
                </div>
                <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-lipro-600/80 dark:text-lipro-200/80">
                  <input type="checkbox" checked={save} onChange={(e) => setSave(e.target.checked)} className="h-4 w-4 accent-lipro-600" />
                  Save to question bank
                </label>
                <Button onClick={generate} disabled={generating || formats.length === 0} className="mt-4">
                  {generating ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating {target} questions… (can take a minute)</> : <><Sparkles className="h-4 w-4" /> Generate {target} questions</>}
                </Button>

                {usedFallback && (
                  <p className="mt-3 flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400"><AlertTriangle className="h-3.5 w-3.5" /> Demo questions — add your NVIDIA API key in Settings → AI API Key for real AI-generated questions.</p>
                )}
                {generationError && <p className="mt-3 text-sm text-rose-500">{generationError}</p>}

                {results && (
                  <div className="mt-4 space-y-3">
                    <p className="text-sm font-medium">Generated {results.length} question{results.length === 1 ? '' : 's'}</p>
                    {save && <p className="flex items-center gap-2 text-xs font-medium text-green-600 dark:text-green-400"><CheckCircle2 className="h-4 w-4" /> Saved {results.length} question{results.length === 1 ? '' : 's'} to the question bank.</p>}
                    <div className="max-h-96 space-y-3 overflow-y-auto pr-1">
                      {results.map((q, i) => (
                        <div key={i} className="rounded-xl border border-lipro-200/50 p-3 dark:border-lipro-700/40">
                          <Badge tone={FORMAT_TONE[q.type]}>{FORMAT_LABELS[q.type]}</Badge>
                          <p className="mt-2 text-sm">{q.question}</p>
                          {q.options && (
                            <ul className="mt-2 space-y-1">
                              {q.options.map((o, j) => (
                                <li key={j} className={cn('rounded-lg px-2 py-1 text-xs', o === q.answer ? 'bg-green-100/70 font-medium text-green-700 dark:bg-green-950/40 dark:text-green-300' : 'text-lipro-600/80 dark:text-lipro-200/70')}>{String.fromCharCode(65 + j)}. {o}</li>
                              ))}
                            </ul>
                          )}
                          <p className="mt-2 text-xs text-green-600 dark:text-green-400"><span className="font-semibold">Answer:</span> {q.answer}</p>
                          {q.explanation && <p className="mt-1 text-xs text-lipro-600/70 dark:text-lipro-200/60">{q.explanation}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
