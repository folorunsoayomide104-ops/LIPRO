'use client';
import { useState } from 'react';
import { Plus } from 'lucide-react';

const inputCls = 'h-11 w-full rounded-lg bg-studio-elevated px-3 text-sm text-studio-fg shadow-studio-border outline-none placeholder:text-studio-subtle';
const labelCls = 'text-xs font-medium uppercase tracking-[0.14em] text-studio-subtle';

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
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="inline-flex h-9 w-fit items-center gap-1.5 rounded-full bg-studio-elevated px-3 text-xs font-medium text-studio-muted shadow-studio-border hover:text-studio-fg"
    >
      <Plus className="h-4 w-4" /> New course
    </button>
  );

  return (
    <div className="rounded-xl bg-studio-surface p-5 shadow-studio-border">
      <h3 className="font-studio-display text-lg tracking-tight text-studio-fg">Create a course</h3>
      <p className="mt-1 text-sm text-studio-muted">Material for your students.</p>
      <form onSubmit={submit} className="mt-4 grid gap-3 md:grid-cols-2">
        <div><label className={labelCls}>Code</label><input className={`${inputCls} mt-1`} value={form.code} onChange={set('code')} placeholder="CSC401" required /></div>
        <div><label className={labelCls}>Title</label><input className={`${inputCls} mt-1`} value={form.title} onChange={set('title')} required /></div>
        <div className="md:col-span-2"><label className={labelCls}>Description</label><input className={`${inputCls} mt-1`} value={form.description} onChange={set('description')} required /></div>
        <div className="md:col-span-2">
          <label className={labelCls}>Syllabus <span className="normal-case tracking-normal text-studio-subtle">(optional)</span></label>
          <textarea className={`${inputCls} mt-1 min-h-28 resize-y py-2.5`} value={form.syllabus} onChange={set('syllabus')} rows={5} placeholder="Course outline, topics by week, recommended texts…" />
        </div>
        <div><label className={labelCls}>Faculty</label><input className={`${inputCls} mt-1`} value={form.faculty} onChange={set('faculty')} required /></div>
        <div><label className={labelCls}>Department</label><input className={`${inputCls} mt-1`} value={form.department} onChange={set('department')} required /></div>
        <div>
          <label className={labelCls}>Level</label>
          <select className={`${inputCls} mt-1`} value={form.level} onChange={set('level')}>{['100','200','300','400','500','600','Staff'].map(l => <option key={l}>{l}</option>)}</select>
        </div>
        <div>
          <label className={labelCls}>Semester</label>
          <select className={`${inputCls} mt-1`} value={form.semester} onChange={set('semester')}><option>First</option><option>Second</option></select>
        </div>
        {error && <p className="text-sm text-studio-danger md:col-span-2">{error}</p>}
        <div className="flex gap-2 md:col-span-2">
          <button type="submit" disabled={loading} className="inline-flex h-9 items-center rounded-full bg-studio-primary px-4 text-xs font-medium text-studio-primary-fg disabled:opacity-60">
            {loading ? 'Creating…' : 'Create course'}
          </button>
          <button type="button" onClick={() => setOpen(false)} className="inline-flex h-9 items-center rounded-full px-4 text-xs font-medium text-studio-subtle hover:text-studio-fg">Cancel</button>
        </div>
      </form>
    </div>
  );
}
