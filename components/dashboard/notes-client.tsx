'use client';
import { useState } from 'react';
import { Sparkles, X, Trash2, BookOpen, FileText } from 'lucide-react';

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
const selectCls = 'w-full rounded-lg bg-studio-elevated px-3 py-2.5 text-sm text-studio-fg shadow-studio-border outline-none';
const labelCls = 'mb-1 block text-xs font-medium uppercase tracking-[0.14em] text-studio-subtle';

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
    <div className="-mx-4 -mt-2 min-h-[calc(100dvh-4rem)] bg-studio-bg p-4 text-studio-fg md:p-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3 studio-rise">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-studio-subtle">Notes</p>
            <h1 className="mt-2 font-studio-display text-3xl tracking-tight md:text-4xl">My notes.</h1>
            <p className="mt-2 max-w-lg text-sm leading-normal text-studio-muted">Your personal study notes and AI-generated revision guides.</p>
          </div>
          <button
            type="button"
            onClick={() => setShowGenerate((v) => !v)}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-studio-primary px-3 text-xs font-medium text-studio-primary-fg"
          >
            <Sparkles className="h-4 w-4" /> Generate revision guide
          </button>
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

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {notes.length === 0 && (
            <p className="text-sm text-studio-subtle">No notes yet. Create one from a course page, or generate a revision guide from a document above.</p>
          )}
          {notes.map((n) => (
            <div key={n.id} className="group flex h-full flex-col rounded-xl bg-studio-surface p-5 shadow-studio-border studio-rise studio-rise-delay-1">
              <button className="flex-1 text-left" onClick={() => setViewing(n)}>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full bg-studio-elevated px-2.5 py-1 text-xs font-medium text-studio-primary">{n.courseCode || 'General'}</span>
                  {isRevisionGuide(n) && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-studio-elevated px-2.5 py-1 text-xs font-medium text-studio-muted"><BookOpen className="h-3 w-3" /> Revision guide</span>
                  )}
                </div>
                <h3 className="mt-3 font-studio-display text-lg tracking-tight text-studio-fg">{n.title}</h3>
                <p className="text-xs text-studio-subtle">Last updated {new Date(n.updatedAt).toLocaleDateString()}</p>
                <p className="mt-2 line-clamp-3 text-xs text-studio-muted">{n.content.replace(/^\[demo\]\s*/, '').replace(/[#\-*]/g, '')}</p>
              </button>
              <div className="mt-3 flex justify-end">
                <button
                  aria-label={`Delete "${n.title}"`}
                  onClick={() => removeNote(n.id)}
                  className="grid h-7 w-7 place-items-center rounded-full bg-studio-elevated text-studio-subtle opacity-0 shadow-studio-border transition-opacity hover:text-studio-danger group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {viewing && <NoteViewer note={viewing} onClose={() => setViewing(null)} />}
      </div>
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
      <div className="rounded-xl bg-studio-surface p-5 shadow-studio-border">
        <p className="text-sm text-studio-muted">Upload a document in LIPRO AI or the CBT PDF tool first — revision guides generate from a document&apos;s text, page by page.</p>
        <button type="button" onClick={onCancel} className="mt-3 inline-flex h-9 items-center rounded-full px-4 text-xs font-medium text-studio-subtle hover:text-studio-fg">Close</button>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-studio-surface p-5 shadow-studio-border">
      <h3 className="font-studio-display text-lg tracking-tight text-studio-fg">Generate a revision guide from a document</h3>
      <div className="mt-4 flex flex-col gap-3">
        <div>
          <label className={labelCls}>Document</label>
          <select value={materialId} onChange={(e) => pickMaterial(e.target.value)} className={selectCls}>
            {materials.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Save under course (optional)</label>
          <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className={selectCls}>
            <option value="">General (no course)</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.title}</option>)}
          </select>
        </div>
        {error && <p className="text-xs text-studio-danger">{error}</p>}
        {loading && progressNote && <p className="text-xs text-studio-subtle">{progressNote}</p>}
        <div className="flex gap-2">
          <button type="button" onClick={submit} disabled={loading || !materialId} className="inline-flex h-9 items-center rounded-full bg-studio-primary px-4 text-xs font-medium text-studio-primary-fg disabled:opacity-60">
            {loading ? 'Generating…' : 'Generate'}
          </button>
          <button type="button" onClick={onCancel} className="inline-flex h-9 items-center rounded-full px-4 text-xs font-medium text-studio-subtle hover:text-studio-fg">Cancel</button>
        </div>
      </div>
    </div>
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
      <ul key={`ul-${key++}`} className="ml-4 list-disc space-y-1 text-sm text-studio-muted">
        {listBuffer.map((item, i) => <li key={i}>{item}</li>)}
      </ul>
    );
    listBuffer = [];
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (line === '---') {
      flushList();
      blocks.push(<hr key={`hr-${key++}`} className="my-3 border-studio-border" />);
    } else if (line.startsWith('## ')) {
      flushList();
      blocks.push(<h3 key={`h-${key++}`} className="mt-4 font-studio-display text-base tracking-tight text-studio-fg">{line.slice(3)}</h3>);
    } else if (line.startsWith('- ')) {
      listBuffer.push(line.slice(2));
    } else if (line.length > 0) {
      flushList();
      blocks.push(<p key={`p-${key++}`} className="text-sm text-studio-muted">{line}</p>);
    }
  }
  flushList();
  return blocks;
}

function NoteViewer({ note, onClose }: { note: NoteRow; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-studio-bg/70 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-studio-surface p-6 shadow-studio-float"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded-full bg-studio-elevated px-2.5 py-1 text-xs font-medium text-studio-primary">{note.courseCode || 'General'}</span>
              {isRevisionGuide(note) && <span className="inline-flex items-center gap-1 rounded-full bg-studio-elevated px-2.5 py-1 text-xs font-medium text-studio-muted"><BookOpen className="h-3 w-3" /> Revision guide</span>}
            </div>
            <h2 className="mt-2 font-studio-display text-xl tracking-tight text-studio-fg">{note.title}</h2>
          </div>
          <button aria-label="Close" onClick={onClose} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-studio-subtle hover:bg-studio-elevated hover:text-studio-fg">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-1">
          {isRevisionGuide(note) ? renderGuideBody(note.content) : (
            <p className="whitespace-pre-wrap text-sm text-studio-muted">{note.content}</p>
          )}
        </div>
        {note.content.startsWith('[demo]') && (
          <p className="mt-4 flex items-center gap-1.5 text-xs text-amber-400">
            <FileText className="h-3.5 w-3.5" /> Generated in demo mode — add an NVIDIA API key in Settings for a fully AI-written guide.
          </p>
        )}
      </div>
    </div>
  );
}
