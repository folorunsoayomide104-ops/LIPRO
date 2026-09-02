'use client';
import { useState } from 'react';
import { Sparkles, X, Trash2, BookOpen, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

type NoteRow = {
  id: string;
  title: string;
  content: string;
  tags: string | null;
  courseId: string | null;
  courseCode: string | null;
  updatedAt: string;
};

type MaterialOption = { id: string; name: string; courseId: string | null };
type CourseOption = { id: string; code: string; title: string };

const isRevisionGuide = (n: NoteRow) => (n.tags ?? '').split(',').map((t) => t.trim()).includes('revision-guide');

export function NotesClient({
  initialNotes,
  materials,
  courses,
}: {
  initialNotes: NoteRow[];
  materials: MaterialOption[];
  courses: CourseOption[];
}) {
  const [notes, setNotes] = useState(initialNotes);
  const [showGenerate, setShowGenerate] = useState(false);
  const [viewing, setViewing] = useState<NoteRow | null>(null);

  const removeNote = async (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    if (viewing?.id === id) setViewing(null);
    try {
      await fetch(`/api/notes/${id}`, { method: 'DELETE' });
    } catch {
      /* optimistic — a stale note reappearing on next load is low stakes */
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Notes</h1>
          <p className="text-sm text-lipro-600/70 dark:text-lipro-200/70">Your personal study notes and AI-generated revision guides</p>
        </div>
        <Button size="sm" onClick={() => setShowGenerate((v) => !v)}>
          <Sparkles className="h-4 w-4" /> Generate revision guide
        </Button>
      </div>

      {showGenerate && (
        <GenerateRevisionGuide
          materials={materials}
          courses={courses}
          onGenerated={(note) => {
            setNotes((prev) => [note, ...prev]);
            setShowGenerate(false);
            setViewing(note);
          }}
          onCancel={() => setShowGenerate(false)}
        />
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {notes.length === 0 && (
          <p className="text-sm text-lipro-600/60">No notes yet. Create one from a course page, or generate a revision guide from a document above.</p>
        )}
        {notes.map((n) => (
          <Card key={n.id} className="group flex h-full flex-col">
            <button className="flex-1 text-left" onClick={() => setViewing(n)}>
              <CardHeader>
                <div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone="purple">{n.courseCode || 'General'}</Badge>
                    {isRevisionGuide(n) && (
                      <Badge tone="indigo" className="gap-1"><BookOpen className="h-3 w-3" /> Revision guide</Badge>
                    )}
                  </div>
                  <CardTitle className="mt-2 text-base">{n.title}</CardTitle>
                  <CardDescription>Last updated {new Date(n.updatedAt).toLocaleDateString()}</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-lipro-700/70 dark:text-lipro-200/70 line-clamp-3">{n.content.replace(/^\[demo\]\s*/, '').replace(/[#\-*]/g, '')}</p>
              </CardContent>
            </button>
            <div className="flex justify-end px-6 pb-4">
              <button
                aria-label={`Delete "${n.title}"`}
                onClick={() => removeNote(n.id)}
                className="grid h-7 w-7 place-items-center rounded-full border border-lipro-200/60 bg-white text-lipro-400 opacity-0 transition-opacity hover:text-rose-500 group-hover:opacity-100 dark:border-lipro-700/40 dark:bg-surface-dark"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </Card>
        ))}
      </div>

      {viewing && <NoteViewer note={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

function GenerateRevisionGuide({
  materials,
  courses,
  onGenerated,
  onCancel,
}: {
  materials: MaterialOption[];
  courses: CourseOption[];
  onGenerated: (note: NoteRow) => void;
  onCancel: () => void;
}) {
  const [materialId, setMaterialId] = useState(materials[0]?.id ?? '');
  const material = materials.find((m) => m.id === materialId);
  // Empty string means "no course" — a study document isn't always tied to
  // a formal course, so this is a real, selectable option, not just a
  // fallback for when the course list happens to be empty.
  const [courseId, setCourseId] = useState(material?.courseId ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [progressNote, setProgressNote] = useState('');

  const pickMaterial = (id: string) => {
    setMaterialId(id);
    const m = materials.find((x) => x.id === id);
    if (m?.courseId) setCourseId(m.courseId);
  };

  const submit = async () => {
    if (!materialId) return;
    setLoading(true);
    setError('');
    setProgressNote('Reading the document page by page — this can take a minute for longer files…');
    try {
      const res = await fetch(`/api/materials/${materialId}/revision-guide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ save: true, courseId: courseId || null }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || 'Could not generate a revision guide from this document.');
        return;
      }
      const course = courses.find((c) => c.id === courseId);
      onGenerated({
        id: data.noteId,
        title: data.title,
        content: data.content,
        tags: 'revision-guide',
        courseId: courseId || null,
        courseCode: course?.code ?? null,
        updatedAt: new Date().toISOString(),
      });
    } finally {
      setLoading(false);
      setProgressNote('');
    }
  };

  if (materials.length === 0) {
    return (
      <Card>
        <CardContent>
          <p className="text-sm text-lipro-600/70 dark:text-lipro-200/60">Upload a document in LIPRO AI or the CBT PDF tool first — revision guides generate from a document&apos;s text, page by page.</p>
          <Button size="sm" variant="ghost" onClick={onCancel}>Close</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Generate a revision guide from a document</CardTitle></CardHeader>
      <CardContent>
        <div>
          <label className="mb-1 block text-xs font-medium text-lipro-600/70 dark:text-lipro-200/60">Document</label>
          <select
            value={materialId}
            onChange={(e) => pickMaterial(e.target.value)}
            className="w-full rounded-xl border border-lipro-300/50 bg-white/70 px-4 py-2.5 text-sm outline-none focus:border-lipro-400 dark:border-lipro-700/40 dark:bg-surface-dark/60"
          >
            {materials.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-lipro-600/70 dark:text-lipro-200/60">Save under course (optional)</label>
          <select
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            className="w-full rounded-xl border border-lipro-300/50 bg-white/70 px-4 py-2.5 text-sm outline-none focus:border-lipro-400 dark:border-lipro-700/40 dark:bg-surface-dark/60"
          >
            <option value="">General (no course)</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.title}</option>)}
          </select>
        </div>
        {error && <p className="text-xs text-rose-500">{error}</p>}
        {loading && progressNote && <p className="text-xs text-lipro-600/60 dark:text-lipro-200/50">{progressNote}</p>}
        <div className="flex gap-2">
          <Button size="sm" onClick={submit} disabled={loading || !materialId}>{loading ? 'Generating…' : 'Generate'}</Button>
          <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function renderGuideBody(content: string) {
  const body = content.replace(/^\[demo\]\s*/, '');
  const lines = body.split('\n');
  const blocks: React.ReactNode[] = [];
  let listBuffer: string[] = [];
  let key = 0;

  const flushList = () => {
    if (listBuffer.length === 0) return;
    blocks.push(
      <ul key={`ul-${key++}`} className="ml-4 list-disc space-y-1 text-sm text-lipro-700/80 dark:text-lipro-200/70">
        {listBuffer.map((item, i) => <li key={i}>{item}</li>)}
      </ul>
    );
    listBuffer = [];
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (line === '---') {
      flushList();
      blocks.push(<hr key={`hr-${key++}`} className="my-3 border-lipro-200/50 dark:border-lipro-700/30" />);
    } else if (line.startsWith('## ')) {
      flushList();
      blocks.push(<h3 key={`h-${key++}`} className="mt-4 text-sm font-bold text-lipro-700 dark:text-lipro-200">{line.slice(3)}</h3>);
    } else if (line.startsWith('- ')) {
      listBuffer.push(line.slice(2));
    } else if (line.length > 0) {
      flushList();
      blocks.push(<p key={`p-${key++}`} className="text-sm text-lipro-700/80 dark:text-lipro-200/70">{line}</p>);
    }
  }
  flushList();
  return blocks;
}

function NoteViewer({ note, onClose }: { note: NoteRow; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="glass max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone="purple">{note.courseCode || 'General'}</Badge>
              {isRevisionGuide(note) && <Badge tone="indigo" className="gap-1"><BookOpen className="h-3 w-3" /> Revision guide</Badge>}
            </div>
            <h2 className="mt-2 text-lg font-bold">{note.title}</h2>
          </div>
          <button aria-label="Close" onClick={onClose} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-lipro-500 hover:bg-lipro-100 dark:hover:bg-lipro-950/60">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-1">
          {isRevisionGuide(note) ? renderGuideBody(note.content) : (
            <p className="whitespace-pre-wrap text-sm text-lipro-700/80 dark:text-lipro-200/70">{note.content}</p>
          )}
        </div>
        {note.content.startsWith('[demo]') && (
          <p className="mt-4 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-300">
            <FileText className="h-3.5 w-3.5" /> Generated in demo mode — add an NVIDIA API key in Settings for a fully AI-written guide.
          </p>
        )}
      </div>
    </div>
  );
}
