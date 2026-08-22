'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input, Label, Textarea } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Plus } from 'lucide-react';

export function CourseForm() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ code: '', title: '', description: '', syllabus: '', faculty: '', department: '', level: '300', semester: 'First' });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    const res = await fetch('/api/courses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const data = await res.json().catch(() => null);
    if (!res.ok) { setError(data?.error || 'Failed'); setLoading(false); return; }
    location.reload();
  };

  if (!open) return (
    <Button variant="outline" size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New course</Button>
  );

  return (
    <Card>
      <CardHeader><CardTitle>Create a course</CardTitle><CardDescription>Material for your students</CardDescription></CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-3 md:grid-cols-2">
          <div><Label>Code</Label><Input value={form.code} onChange={set('code')} placeholder="CSC401" required /></div>
          <div><Label>Title</Label><Input value={form.title} onChange={set('title')} required /></div>
          <div className="md:col-span-2"><Label>Description</Label><Input value={form.description} onChange={set('description')} required /></div>
          <div className="md:col-span-2">
            <Label>Syllabus <span className="font-normal text-lipro-600/60 dark:text-lipro-300/60">(optional)</span></Label>
            <Textarea value={form.syllabus} onChange={set('syllabus')} rows={5} placeholder="Course outline, topics by week, recommended texts…" />
          </div>
          <div><Label>Faculty</Label><Input value={form.faculty} onChange={set('faculty')} required /></div>
          <div><Label>Department</Label><Input value={form.department} onChange={set('department')} required /></div>
          <div><Label>Level</Label>
            <select className="input" value={form.level} onChange={set('level')}>{['100','200','300','400','500','600','Staff'].map(l => <option key={l}>{l}</option>)}</select>
          </div>
          <div><Label>Semester</Label>
            <select className="input" value={form.semester} onChange={set('semester')}><option>First</option><option>Second</option></select>
          </div>
          {error && <p className="text-sm text-rose-500 md:col-span-2">{error}</p>}
          <div className="md:col-span-2 flex gap-2">
            <Button type="submit" disabled={loading}>{loading ? 'Creating…' : 'Create course'}</Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
