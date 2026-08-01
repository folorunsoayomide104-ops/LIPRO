'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input, Label, Textarea } from '@/components/ui/input';
import { Plus } from 'lucide-react';

const TYPES = ['MCQ', 'TRUE_FALSE', 'FILL_BLANK', 'THEORY', 'ESSAY', 'MATCHING', 'IMAGE'] as const;

export function QuestionManager({ courseId }: { courseId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState<typeof TYPES[number]>('MCQ');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [options, setOptions] = useState('');
  const [explanation, setExplanation] = useState('');
  const [points, setPoints] = useState(1);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const opts = type === 'MCQ' || type === 'MATCHING' ? JSON.stringify(options.split('\n').filter(Boolean)) : null;
    const res = await fetch('/api/cbt/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseId, type, question, answer, options: opts, explanation: explanation || null, points }),
    });
    if (res.ok) location.reload();
    setLoading(false);
  };

  if (!open) return <Button variant="outline" size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Add question</Button>;
  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl glass p-4">
      <div><Label>Question type</Label>
        <select className="input" value={type} onChange={(e) => setType(e.target.value as any)}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select>
      </div>
      <div><Label>Question</Label><Textarea value={question} onChange={(e) => setQuestion(e.target.value)} required /></div>
      {(type === 'MCQ' || type === 'MATCHING') && (
        <div><Label>Options (one per line)</Label><Textarea value={options} onChange={(e) => setOptions(e.target.value)} placeholder={'Option A\nOption B\nOption C\nOption D'} /></div>
      )}
      <div><Label>Correct answer</Label><Input value={answer} onChange={(e) => setAnswer(e.target.value)} required /></div>
      <div><Label>Explanation (optional)</Label><Textarea value={explanation} onChange={(e) => setExplanation(e.target.value)} /></div>
      <div><Label>Points</Label><Input type="number" min={1} value={points} onChange={(e) => setPoints(Number(e.target.value))} /></div>
      <div className="flex gap-2"><Button type="submit" disabled={loading}>{loading ? 'Adding…' : 'Add question'}</Button><Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button></div>
    </form>
  );
}
