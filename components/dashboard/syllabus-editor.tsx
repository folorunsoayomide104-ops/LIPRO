'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
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
      <div className="space-y-2">
        <Textarea value={value} onChange={(e) => setValue(e.target.value)} rows={8} placeholder="Course outline, topics by week, recommended texts…" />
        {error && <p className="text-sm text-rose-500">{error}</p>}
        <div className="flex gap-2">
          <Button size="sm" onClick={save} disabled={loading}>{loading ? 'Saving…' : 'Save syllabus'}</Button>
          <Button size="sm" variant="ghost" onClick={() => { setValue(saved || ''); setEditing(false); }}>Cancel</Button>
        </div>
      </div>
    );
  }

  if (!saved) {
    return canManage ? (
      <button onClick={() => setEditing(true)} className="text-sm font-medium text-lipro-600 hover:underline dark:text-lipro-300">
        + Add a syllabus
      </button>
    ) : null;
  }

  return (
    <div>
      <p className="whitespace-pre-wrap text-sm text-lipro-700/80 dark:text-lipro-200/80">{saved}</p>
      {canManage && (
        <button onClick={() => setEditing(true)} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-lipro-600/70 hover:underline dark:text-lipro-300/70">
          <Pencil className="h-3 w-3" /> Edit syllabus
        </button>
      )}
    </div>
  );
}
