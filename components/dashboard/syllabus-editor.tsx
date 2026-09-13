'use client';
import { useState } from 'react';
import { Pencil } from 'lucide-react';

export function SyllabusEditor({ courseId, initialSyllabus, canManage }: { courseId: string; initialSyllabus: string | null; canManage: boolean }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialSyllabus || '');
  const [saved, setSaved] = useState(initialSyllabus);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setLoading(true); setError('');
    const res = await fetch(`/api/courses/${courseId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ syllabus: value }),
    });
    const data = await res.json().catch(() => null);
    setLoading(false);
    if (!res.ok) { setError(data?.error || 'Could not save syllabus'); return; }
    setSaved(value);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex flex-col gap-2">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={8}
          placeholder="Course outline, topics by week, recommended texts…"
          className="w-full resize-y rounded-lg bg-studio-elevated px-3 py-2.5 text-sm text-studio-fg shadow-studio-border outline-none placeholder:text-studio-subtle"
        />
        {error && <p className="text-sm text-studio-danger">{error}</p>}
        <div className="flex gap-2">
          <button onClick={save} disabled={loading} className="inline-flex h-9 items-center rounded-full bg-studio-primary px-4 text-xs font-medium text-studio-primary-fg disabled:opacity-60">
            {loading ? 'Saving…' : 'Save syllabus'}
          </button>
          <button onClick={() => { setValue(saved || ''); setEditing(false); }} className="inline-flex h-9 items-center rounded-full px-4 text-xs font-medium text-studio-subtle hover:text-studio-fg">Cancel</button>
        </div>
      </div>
    );
  }

  if (!saved) {
    return canManage ? (
      <button onClick={() => setEditing(true)} className="text-sm font-medium text-studio-primary hover:underline">
        + Add a syllabus
      </button>
    ) : null;
  }

  return (
    <div>
      <p className="whitespace-pre-wrap text-sm text-studio-muted">{saved}</p>
      {canManage && (
        <button onClick={() => setEditing(true)} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-studio-subtle hover:text-studio-fg">
          <Pencil className="h-3 w-3" /> Edit syllabus
        </button>
      )}
    </div>
  );
}
