'use client';
import { useState } from 'react';
import { Plus } from 'lucide-react';

export function NoteEditor({ courseId }: { courseId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await fetch('/api/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, content, courseId, tags }) });
    if (res.ok) location.reload();
    setLoading(false);
  };

  if (!open) return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="inline-flex h-9 items-center gap-1.5 rounded-full bg-studio-elevated px-3 text-xs font-medium text-studio-muted shadow-studio-border hover:text-studio-fg"
    >
      <Plus className="h-4 w-4" /> Add note
    </button>
  );

  const inputCls = 'mt-1 h-11 w-full rounded-lg bg-studio-elevated px-3 text-sm text-studio-fg shadow-studio-border outline-none placeholder:text-studio-subtle';
  const labelCls = 'text-xs font-medium uppercase tracking-[0.14em] text-studio-subtle';

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-lg bg-studio-elevated p-4">
      <div><label className={labelCls}>Title</label><input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} required /></div>
      <div><label className={labelCls}>Content</label><textarea className={`${inputCls} min-h-24 resize-y py-2.5`} value={content} onChange={(e) => setContent(e.target.value)} required /></div>
      <div><label className={labelCls}>Tags (comma-separated)</label><input className={inputCls} value={tags} onChange={(e) => setTags(e.target.value)} placeholder="arrays, revision" /></div>
      <div className="flex gap-2">
        <button type="submit" disabled={loading} className="inline-flex h-9 items-center rounded-full bg-studio-primary px-4 text-xs font-medium text-studio-primary-fg disabled:opacity-60">
          {loading ? 'Saving…' : 'Save note'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="inline-flex h-9 items-center rounded-full px-4 text-xs font-medium text-studio-subtle hover:text-studio-fg">Cancel</button>
      </div>
    </form>
  );
}
