'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input, Label, Textarea } from '@/components/ui/input';
import { Megaphone } from 'lucide-react';

const selectClass =
  'rounded-xl border border-lipro-200/60 bg-white px-3 py-2 text-sm dark:border-lipro-500/20 dark:bg-surface-dark dark:text-lipro-50';

export function AnnouncementForm({
  faculties,
  departments,
  levels,
  semesters,
}: {
  faculties: string[];
  departments: string[];
  levels: string[];
  semesters: string[];
}) {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [faculty, setFaculty] = useState('');
  const [department, setDepartment] = useState('');
  const [level, setLevel] = useState('');
  const [semester, setSemester] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sentTo, setSentTo] = useState<number | null>(null);

  const audienceLabel = faculty || department || level || semester
    ? [faculty, department, level && `Level ${level}`, semester && `${semester} semester`].filter(Boolean).join(' · ')
    : 'All students';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(''); setSentTo(null);
    const res = await fetch('/api/admin/announcements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, message, faculty, department, level, semester }),
    });
    const data = await res.json().catch(() => null);
    setLoading(false);
    if (!res.ok) { setError(data?.error || 'Could not send announcement'); return; }
    setSentTo(data.sentTo);
    setTitle('');
    setMessage('');
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <Label>Title</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Exam schedule update" required maxLength={200} />
      </div>
      <div>
        <Label>Message</Label>
        <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} placeholder="Write your announcement…" required maxLength={5000} />
      </div>

      <div>
        <Label>Audience</Label>
        <div className="mt-1 flex flex-wrap gap-2">
          <select className={selectClass} value={faculty} onChange={(e) => setFaculty(e.target.value)}>
            <option value="">All faculties</option>
            {faculties.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          <select className={selectClass} value={department} onChange={(e) => setDepartment(e.target.value)}>
            <option value="">All departments</option>
            {departments.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <select className={selectClass} value={level} onChange={(e) => setLevel(e.target.value)}>
            <option value="">All levels</option>
            {levels.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          <select className={selectClass} value={semester} onChange={(e) => setSemester(e.target.value)}>
            <option value="">All semesters</option>
            {semesters.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <p className="mt-1.5 text-xs text-lipro-600/60 dark:text-lipro-200/60">Sending to: <span className="font-medium">{audienceLabel}</span></p>
      </div>

      {error && <p className="text-sm text-rose-500">{error}</p>}
      {sentTo !== null && <p className="text-sm text-green-600 dark:text-green-400">Sent to {sentTo} student{sentTo === 1 ? '' : 's'}.</p>}

      <Button type="submit" disabled={loading}>
        <Megaphone className="h-4 w-4" /> {loading ? 'Sending…' : 'Send announcement'}
      </Button>
    </form>
  );
}
