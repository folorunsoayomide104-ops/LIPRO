'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Search } from 'lucide-react';

const selectClass =
  'rounded-xl border border-lipro-200/60 bg-white px-3 py-2 text-sm dark:border-lipro-500/20 dark:bg-surface-dark dark:text-lipro-50';

export function StudentFilters({
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
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get('q') || '');

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('page');
    router.push(`/admin/students?${next.toString()}`);
  };

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    update('q', q);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form onSubmit={submitSearch} className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-lipro-500/60" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, email, matric…"
          className={`${selectClass} w-56 pl-8`}
        />
      </form>

      <select className={selectClass} value={params.get('faculty') || ''} onChange={(e) => update('faculty', e.target.value)}>
        <option value="">All faculties</option>
        {faculties.map((f) => <option key={f} value={f}>{f}</option>)}
      </select>

      <select className={selectClass} value={params.get('department') || ''} onChange={(e) => update('department', e.target.value)}>
        <option value="">All departments</option>
        {departments.map((d) => <option key={d} value={d}>{d}</option>)}
      </select>

      <select className={selectClass} value={params.get('level') || ''} onChange={(e) => update('level', e.target.value)}>
        <option value="">All levels</option>
        {levels.map((l) => <option key={l} value={l}>{l}</option>)}
      </select>

      <select className={selectClass} value={params.get('semester') || ''} onChange={(e) => update('semester', e.target.value)}>
        <option value="">All semesters</option>
        {semesters.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>

      <select className={selectClass} value={params.get('activity') || ''} onChange={(e) => update('activity', e.target.value)}>
        <option value="">Any activity</option>
        <option value="active30">Active in last 30 days</option>
        <option value="never">Never logged in</option>
      </select>

      {(params.get('faculty') || params.get('department') || params.get('level') || params.get('semester') || params.get('activity') || params.get('q')) && (
        <button
          onClick={() => router.push('/admin/students')}
          className="text-xs font-medium text-lipro-600/70 hover:underline dark:text-lipro-300/70"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
