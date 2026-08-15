'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input, Label, Textarea } from '@/components/ui/input';
import { Plus, Trash2, Pencil, X, Loader2 } from 'lucide-react';

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
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {!creating && <Button variant="outline" size="sm" onClick={startCreate}><Plus className="h-4 w-4" /> Add question</Button>}
        <Button variant="ghost" size="sm" onClick={() => setShowList((s) => !s)}>
          {showList ? 'Hide' : 'Manage'} existing questions
        </Button>
      </div>

      {creating && (
        <form onSubmit={submit} className="space-y-3 rounded-xl glass p-4">
          <div className="flex items-center justify-between">
            <Label>{editingId ? 'Edit question' : 'New question'}</Label>
            <button type="button" onClick={cancelForm} className="text-lipro-500 hover:text-lipro-700"><X className="h-4 w-4" /></button>
          </div>
          <div><Label>Question type</Label>
            <select className="input" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as QType }))}>
              {TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div><Label>Question</Label><Textarea value={form.question} onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))} required /></div>
          {form.type === 'MCQ' && (
            <div><Label>Options (one per line)</Label><Textarea value={form.options} onChange={(e) => setForm((f) => ({ ...f, options: e.target.value }))} placeholder={'Option A\nOption B\nOption C\nOption D'} /></div>
          )}
          <div><Label>Correct answer</Label><Input value={form.answer} onChange={(e) => setForm((f) => ({ ...f, answer: e.target.value }))} required /></div>
          <div><Label>Explanation (optional)</Label><Textarea value={form.explanation} onChange={(e) => setForm((f) => ({ ...f, explanation: e.target.value }))} /></div>
          <div><Label>Points</Label><Input type="number" min={1} value={form.points} onChange={(e) => setForm((f) => ({ ...f, points: Number(e.target.value) }))} /></div>
          {error && <p className="text-xs text-rose-500">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add question'}</Button>
            <Button type="button" variant="ghost" onClick={cancelForm}>Cancel</Button>
          </div>
        </form>
      )}

      {showList && (
        <div className="space-y-2">
          {loadingList && <div className="flex items-center gap-2 text-xs text-lipro-600/60"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…</div>}
          {!loadingList && questions.length === 0 && <p className="text-xs text-lipro-600/60">No questions yet.</p>}
          {questions.map((q) => (
            <div key={q.id} className="flex items-start justify-between gap-2 rounded-xl p-2.5 glass-hover">
              <div className="min-w-0">
                <div className="text-xs font-medium text-lipro-500">{q.type} · {q.points} pts</div>
                <div className="truncate text-sm">{q.question}</div>
              </div>
              <div className="flex shrink-0 gap-1">
                <button type="button" onClick={() => startEdit(q)} className="rounded-lg p-1.5 text-lipro-500 hover:bg-lipro-100 hover:text-lipro-700 dark:hover:bg-lipro-950/40" title="Edit">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => remove(q.id)} disabled={deletingId === q.id} className="rounded-lg p-1.5 text-lipro-500 hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-950/40" title="Delete">
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
