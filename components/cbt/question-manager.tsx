'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Pencil, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const TYPES = ['MCQ', 'TRUE_FALSE', 'FILL_BLANK', 'THEORY', 'ESSAY'] as const;
type QType = (typeof TYPES)[number];

type QuestionRow = {
  id: string;
  type: QType;
  question: string;
  options: string | null;
  answer: string;
  explanation: string | null;
  points: number;
};

type FormState = { type: QType; question: string; answer: string; options: string; explanation: string; points: number };

const EMPTY_FORM: FormState = { type: 'MCQ', question: '', answer: '', options: '', explanation: '', points: 1 };

function toForm(q: QuestionRow): FormState {
  let options = '';
  try {
    const parsed = q.options ? JSON.parse(q.options) : [];
    options = Array.isArray(parsed) ? parsed.join('\n') : '';
  } catch {
    options = '';
  }
  return { type: q.type, question: q.question, answer: q.answer, options, explanation: q.explanation ?? '', points: q.points };
}

const inputCls = 'w-full rounded-lg bg-studio-bg px-3 py-2 text-sm text-studio-fg shadow-studio-border outline-none placeholder:text-studio-subtle';
const labelCls = 'text-xs font-medium uppercase tracking-[0.14em] text-studio-subtle';

/**
 * Question bank manager for a course or a material. Handles create, edit, and
 * delete — previously this component could only create, and questions were
 * uneditable once saved.
 */
export function QuestionManager({ courseId, sourceId }: { courseId?: string; sourceId?: string }) {
  const router = useRouter();
  const query = courseId ? `courseId=${courseId}` : `sourceId=${sourceId}`;

  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [showList, setShowList] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const loadQuestions = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetch(`/api/cbt/questions?${query}&includeAnswers=1`);
      const data = await res.json().catch(() => null);
      if (res.ok) setQuestions(data.questions ?? []);
    } finally {
      setLoadingList(false);
    }
  }, [query]);

  useEffect(() => {
    if (showList) loadQuestions();
  }, [showList, loadQuestions]);

  const startCreate = () => { setForm(EMPTY_FORM); setEditingId(null); setCreating(true); setError(''); };
  const startEdit = (q: QuestionRow) => { setForm(toForm(q)); setEditingId(q.id); setCreating(true); setError(''); };
  const cancelForm = () => { setCreating(false); setEditingId(null); setError(''); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    const opts = form.type === 'MCQ' ? form.options.split('\n').map((s) => s.trim()).filter(Boolean) : null;
    const payload = {
      ...(courseId ? { courseId } : { sourceId }),
      type: form.type,
      question: form.question,
      answer: form.answer,
      options: opts,
      explanation: form.explanation || null,
      points: form.points,
    };
    try {
      const res = editingId
        ? await fetch(`/api/cbt/questions/${editingId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        : await fetch('/api/cbt/questions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Could not save this question');
      setCreating(false);
      setEditingId(null);
      router.refresh();
      if (showList) loadQuestions();
    } catch (err: any) {
      setError(err?.message || 'Could not save this question');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this question? This cannot be undone.')) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/cbt/questions/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setQuestions((qs) => qs.filter((q) => q.id !== id));
      router.refresh();
    } catch {
      setError('Could not delete this question');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-3 text-studio-fg">
      <div className="flex flex-wrap gap-2">
        {!creating && (
          <button type="button" onClick={startCreate} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-studio-elevated px-3 text-xs font-medium text-studio-muted shadow-studio-border hover:text-studio-fg">
            <Plus className="h-3.5 w-3.5" /> Add question
          </button>
        )}
        <button type="button" onClick={() => setShowList((s) => !s)} className="inline-flex h-8 items-center rounded-full px-3 text-xs font-medium text-studio-subtle hover:text-studio-fg">
          {showList ? 'Hide' : 'Manage'} existing questions
        </button>
      </div>

      {creating && (
        <form onSubmit={submit} className="flex flex-col gap-3 rounded-lg bg-studio-surface p-4 shadow-studio-border">
          <div className="flex items-center justify-between">
            <span className={labelCls}>{editingId ? 'Edit question' : 'New question'}</span>
            <button type="button" onClick={cancelForm} className="text-studio-subtle hover:text-studio-fg"><X className="h-4 w-4" /></button>
          </div>
          <div>
            <label className={labelCls}>Question type</label>
            <select className={cn(inputCls, 'mt-1')} value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as QType }))}>
              {TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Question</label>
            <textarea className={cn(inputCls, 'mt-1 min-h-20 resize-y')} value={form.question} onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))} required />
          </div>
          {form.type === 'MCQ' && (
            <div>
              <label className={labelCls}>Options (one per line)</label>
              <textarea className={cn(inputCls, 'mt-1 min-h-20 resize-y')} value={form.options} onChange={(e) => setForm((f) => ({ ...f, options: e.target.value }))} placeholder={'Option A\nOption B\nOption C\nOption D'} />
            </div>
          )}
          <div>
            <label className={labelCls}>Correct answer</label>
            <input className={cn(inputCls, 'mt-1')} value={form.answer} onChange={(e) => setForm((f) => ({ ...f, answer: e.target.value }))} required />
          </div>
          <div>
            <label className={labelCls}>Explanation (optional)</label>
            <textarea className={cn(inputCls, 'mt-1 min-h-16 resize-y')} value={form.explanation} onChange={(e) => setForm((f) => ({ ...f, explanation: e.target.value }))} />
          </div>
          <div>
            <label className={labelCls}>Points</label>
            <input type="number" min={1} className={cn(inputCls, 'mt-1')} value={form.points} onChange={(e) => setForm((f) => ({ ...f, points: Number(e.target.value) }))} />
          </div>
          {error && <p className="text-xs text-studio-danger">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-studio-primary px-4 text-xs font-medium text-studio-primary-fg disabled:opacity-60">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add question'}
            </button>
            <button type="button" onClick={cancelForm} className="inline-flex h-9 items-center rounded-full px-4 text-xs font-medium text-studio-subtle hover:text-studio-fg">Cancel</button>
          </div>
        </form>
      )}

      {showList && (
        <div className="flex flex-col gap-2">
          {loadingList && <div className="flex items-center gap-2 text-xs text-studio-subtle"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…</div>}
          {!loadingList && questions.length === 0 && <p className="text-xs text-studio-subtle">No questions yet.</p>}
          {questions.map((q) => (
            <div key={q.id} className="flex items-start justify-between gap-2 rounded-lg bg-studio-elevated p-2.5">
              <div className="min-w-0">
                <div className="text-xs font-medium text-studio-primary">{q.type} · {q.points} pts</div>
                <div className="truncate text-sm text-studio-fg">{q.question}</div>
              </div>
              <div className="flex shrink-0 gap-1">
                <button type="button" onClick={() => startEdit(q)} className="rounded-full p-1.5 text-studio-subtle hover:bg-studio-surface hover:text-studio-fg" title="Edit">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => remove(q.id)} disabled={deletingId === q.id} className="rounded-full p-1.5 text-studio-subtle hover:bg-studio-surface hover:text-studio-danger" title="Delete">
                  {deletingId === q.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
