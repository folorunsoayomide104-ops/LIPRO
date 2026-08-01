'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input, Label, Textarea } from '@/components/ui/input';
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

  if (!open) return <Button variant="outline" size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Add note</Button>;
  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl glass p-4">
      <div><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} required /></div>
      <div><Label>Content</Label><Textarea value={content} onChange={(e) => setContent(e.target.value)} required /></div>
      <div><Label>Tags (comma-separated)</Label><Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="arrays, revision" /></div>
      <div className="flex gap-2"><Button type="submit" disabled={loading}>{loading ? 'Saving…' : 'Save note'}</Button><Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button></div>
    </form>
  );
}
