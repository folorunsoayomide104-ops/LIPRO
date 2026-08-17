'use client';
import { useMemo, useState } from 'react';
import { Layers, Plus, Sparkles, Trash2, X, Check, RotateCcw, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type FlashcardRow = {
  id: string;
  front: string;
  back: string;
  timesSeen: number;
  timesCorrect: number;
  courseCode: string | null;
  materialName: string | null;
  materialId: string | null;
};

type MaterialOption = { id: string; name: string };

type Deck = { key: string; label: string; cards: FlashcardRow[] };

function groupIntoDecks(cards: FlashcardRow[]): Deck[] {
  const byMaterial = new Map<string, Deck>();
  const manual: FlashcardRow[] = [];
  for (const c of cards) {
    if (c.materialId && c.materialName) {
      const existing = byMaterial.get(c.materialId);
      if (existing) existing.cards.push(c);
      else byMaterial.set(c.materialId, { key: c.materialId, label: c.materialName, cards: [c] });
    } else {
      manual.push(c);
    }
  }
  const decks = Array.from(byMaterial.values());
  if (manual.length > 0) decks.push({ key: 'manual', label: 'Manually added', cards: manual });
  return decks;
}

export function FlashcardsClient({ initialCards, materials }: { initialCards: FlashcardRow[]; materials: MaterialOption[] }) {
  const [cards, setCards] = useState(initialCards);
  const [mode, setMode] = useState<'browse' | 'study'>('browse');
  const [studyDeckKey, setStudyDeckKey] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);

  const decks = useMemo(() => groupIntoDecks(cards), [cards]);
  const studyCards = studyDeckKey === 'all' ? cards : decks.find((d) => d.key === studyDeckKey)?.cards ?? [];

  const removeCard = async (id: string) => {
    setCards((prev) => prev.filter((c) => c.id !== id));
    try {
      await fetch(`/api/flashcards/${id}`, { method: 'DELETE' });
    } catch { /* optimistic — a stale card reappearing on next load is low stakes */ }
  };

  const addCard = (card: FlashcardRow) => setCards((prev) => [card, ...prev]);

  const startStudy = (deckKey: string) => {
    setStudyDeckKey(deckKey);
    setMode('study');
  };

  const recordReview = (id: string, correct: boolean) => {
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, timesSeen: c.timesSeen + 1, timesCorrect: c.timesCorrect + (correct ? 1 : 0) } : c)));
    fetch(`/api/flashcards/${id}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correct }),
    }).catch(() => {});
  };

  if (mode === 'study') {
    return (
      <StudySession
        cards={studyCards}
        onExit={() => setMode('browse')}
        onReview={recordReview}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Flashcards</h1>
          <p className="text-sm text-lipro-600/70 dark:text-lipro-200/70">Generate cards from your documents, or add your own — then study them.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowAddForm((v) => !v)}><Plus className="h-4 w-4" /> Add card</Button>
          <Button size="sm" onClick={() => setShowGenerate((v) => !v)}><Sparkles className="h-4 w-4" /> Generate from document</Button>
        </div>
      </div>

      {showAddForm && (
        <AddCardForm
          onCreated={(card) => { addCard(card); setShowAddForm(false); }}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {showGenerate && (
        <GenerateFromDocument
          materials={materials}
          onGenerated={(newCards) => { setCards((prev) => [...newCards, ...prev]); setShowGenerate(false); }}
          onCancel={() => setShowGenerate(false)}
        />
      )}

      {cards.length > 0 && (
        <Card className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-lipro-500 to-indigo-500 text-white"><Layers className="h-5 w-5" /></span>
            <div>
              <div className="text-sm font-semibold">All cards</div>
              <div className="text-xs text-lipro-600/60">{cards.length} card{cards.length === 1 ? '' : 's'} across every deck</div>
            </div>
          </div>
          <Button size="sm" onClick={() => startStudy('all')}>Study all</Button>
        </Card>
      )}

      {decks.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-lipro-300/50 py-16 text-center dark:border-lipro-700/40">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-lipro-100 text-lipro-600 dark:bg-lipro-950/60 dark:text-lipro-300">
            <Layers className="h-6 w-6" />
          </div>
          <div>
            <p className="font-medium">No flashcards yet</p>
            <p className="mt-1 text-sm text-lipro-600/60 dark:text-lipro-300/60">Generate a set from a document you've already uploaded, or add one manually.</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {decks.map((deck) => (
            <Card key={deck.key}>
              <CardHeader>
                <div>
                  <Badge tone="indigo">{deck.cards.length} card{deck.cards.length === 1 ? '' : 's'}</Badge>
                  <CardTitle className="mt-2 truncate text-base">{deck.label}</CardTitle>
                  <CardDescription>Study progress: {deck.cards.filter((c) => c.timesSeen > 0).length} of {deck.cards.length} reviewed</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {deck.cards.slice(0, 3).map((c) => (
                    <span key={c.id} className="max-w-[140px] truncate rounded-lg bg-lipro-50/60 px-2 py-1 text-[11px] text-lipro-700/80 dark:bg-lipro-950/40 dark:text-lipro-200/70">{c.front}</span>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <Button size="sm" onClick={() => startStudy(deck.key)}>Study deck</Button>
                  <div className="flex -space-x-1">
                    {deck.cards.slice(0, 4).map((c) => (
                      <button
                        key={c.id}
                        title={`Delete "${c.front}"`}
                        aria-label={`Delete card ${c.front}`}
                        onClick={() => removeCard(c.id)}
                        className="grid h-7 w-7 place-items-center rounded-full border border-lipro-200/60 bg-white text-lipro-400 opacity-0 transition-opacity hover:opacity-100 hover:text-rose-500 dark:border-lipro-700/40 dark:bg-surface-dark group-hover:opacity-100"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function AddCardForm({ onCreated, onCancel }: { onCreated: (c: FlashcardRow) => void; onCancel: () => void }) {
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!front.trim() || !back.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/flashcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ front: front.trim(), back: back.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) { setError(data?.error || 'Could not save this card.'); return; }
      onCreated({ id: data.card.id, front: data.card.front, back: data.card.back, timesSeen: 0, timesCorrect: 0, courseCode: null, materialName: null, materialId: null });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Add a flashcard</CardTitle></CardHeader>
      <CardContent>
        <input
          value={front}
          onChange={(e) => setFront(e.target.value)}
          placeholder="Front — the question or term"
          className="w-full rounded-xl border border-lipro-300/50 bg-white/70 px-4 py-2.5 text-sm outline-none placeholder:text-lipro-400/70 focus:border-lipro-400 focus:ring-4 focus:ring-lipro-400/15 dark:border-lipro-700/40 dark:bg-surface-dark/60"
        />
        <textarea
          value={back}
          onChange={(e) => setBack(e.target.value)}
          placeholder="Back — the answer"
          rows={2}
          className="w-full resize-none rounded-xl border border-lipro-300/50 bg-white/70 px-4 py-2.5 text-sm outline-none placeholder:text-lipro-400/70 focus:border-lipro-400 focus:ring-4 focus:ring-lipro-400/15 dark:border-lipro-700/40 dark:bg-surface-dark/60"
        />
        {error && <p className="text-xs text-rose-500">{error}</p>}
        <div className="flex gap-2">
          <Button size="sm" onClick={submit} disabled={loading || !front.trim() || !back.trim()}>{loading ? 'Saving…' : 'Save card'}</Button>
          <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function GenerateFromDocument({ materials, onGenerated, onCancel }: { materials: MaterialOption[]; onGenerated: (cards: FlashcardRow[]) => void; onCancel: () => void }) {
  const [materialId, setMaterialId] = useState(materials[0]?.id ?? '');
  const [count, setCount] = useState(12);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!materialId) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/materials/${materialId}/flashcards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count, save: true }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) { setError(data?.error || 'Could not generate flashcards.'); return; }
      const materialName = materials.find((m) => m.id === materialId)?.name ?? null;
      const created: FlashcardRow[] = (data.cards as Array<{ id: string; front: string; back: string }>)
        .filter((c) => c.id)
        .map((c) => ({ id: c.id, front: c.front, back: c.back, timesSeen: 0, timesCorrect: 0, courseCode: null, materialName, materialId }));
      onGenerated(created);
    } finally {
      setLoading(false);
    }
  };

  if (materials.length === 0) {
    return (
      <Card>
        <CardContent>
          <p className="text-sm text-lipro-600/70 dark:text-lipro-200/60">Upload a document in LIPRO AI or the CBT PDF tool first — flashcards generate from a document's text.</p>
          <Button size="sm" variant="ghost" onClick={onCancel}>Close</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Generate flashcards from a document</CardTitle></CardHeader>
      <CardContent>
        <select
          value={materialId}
          onChange={(e) => setMaterialId(e.target.value)}
          className="w-full rounded-xl border border-lipro-300/50 bg-white/70 px-4 py-2.5 text-sm outline-none focus:border-lipro-400 dark:border-lipro-700/40 dark:bg-surface-dark/60"
        >
          {materials.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <div className="flex items-center gap-3">
          <label className="text-xs font-medium text-lipro-600/70 dark:text-lipro-200/60">Number of cards</label>
          <input
            type="number"
            min={4}
            max={60}
            value={count}
            onChange={(e) => setCount(Math.max(4, Math.min(60, Number(e.target.value) || 12)))}
            className="w-20 rounded-xl border border-lipro-300/50 bg-white/70 px-3 py-1.5 text-sm outline-none dark:border-lipro-700/40 dark:bg-surface-dark/60"
          />
        </div>
        {error && <p className="text-xs text-rose-500">{error}</p>}
        <div className="flex gap-2">
          <Button size="sm" onClick={submit} disabled={loading}>{loading ? 'Generating…' : 'Generate'}</Button>
          <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function StudySession({ cards, onExit, onReview }: { cards: FlashcardRow[]; onExit: () => void; onReview: (id: string, correct: boolean) => void }) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState<{ known: number; unknown: number }>({ known: 0, unknown: 0 });

  const card = cards[index];

  const answer = (correct: boolean) => {
    if (!card) return;
    onReview(card.id, correct);
    setDone((d) => (correct ? { ...d, known: d.known + 1 } : { ...d, unknown: d.unknown + 1 }));
    setFlipped(false);
    setIndex((i) => i + 1);
  };

  if (cards.length === 0) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={onExit}><ChevronLeft className="h-4 w-4" /> Back</Button>
        <p className="text-sm text-lipro-600/70">This deck has no cards.</p>
      </div>
    );
  }

  if (index >= cards.length) {
    const total = done.known + done.unknown;
    return (
      <div className="mx-auto max-w-md space-y-6 py-16 text-center">
        <div className="grid h-16 w-16 mx-auto place-items-center rounded-full bg-gradient-to-br from-lipro-500 to-indigo-500 text-white"><Check className="h-8 w-8" /></div>
        <div>
          <h2 className="text-xl font-bold">Session complete</h2>
          <p className="mt-1 text-sm text-lipro-600/70 dark:text-lipro-200/60">You knew {done.known} of {total} cards.</p>
        </div>
        <div className="flex justify-center gap-2">
          <Button variant="outline" onClick={() => { setIndex(0); setDone({ known: 0, unknown: 0 }); }}><RotateCcw className="h-4 w-4" /> Study again</Button>
          <Button onClick={onExit}>Done</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onExit}><ChevronLeft className="h-4 w-4" /> Exit</Button>
        <span className="text-xs font-medium text-lipro-600/60 tabular-nums">{index + 1} / {cards.length}</span>
      </div>

      <div className="[perspective:1200px]">
        <button
          onClick={() => setFlipped((f) => !f)}
          aria-label={flipped ? 'Show question' : 'Show answer'}
          className={cn(
            'relative h-64 w-full [transform-style:preserve-3d] transition-transform duration-500 motion-reduce:transition-none',
            flipped && '[transform:rotateY(180deg)]'
          )}
        >
          <div className="glass absolute inset-0 flex items-center justify-center rounded-2xl p-8 text-center [backface-visibility:hidden]">
            <p className="text-lg font-semibold">{card.front}</p>
          </div>
          <div className="glass absolute inset-0 flex items-center justify-center rounded-2xl p-8 text-center [backface-visibility:hidden] [transform:rotateY(180deg)]">
            <p className="text-base text-lipro-700 dark:text-lipro-200">{card.back}</p>
          </div>
        </button>
      </div>

      {!flipped ? (
        <p className="text-center text-xs text-lipro-600/60">Tap the card to reveal the answer</p>
      ) : (
        <div className="flex justify-center gap-3">
          <Button variant="outline" onClick={() => answer(false)} className="border-rose-300/60 text-rose-600 hover:bg-rose-50 dark:border-rose-800/40 dark:hover:bg-rose-950/30">
            <X className="h-4 w-4" /> Didn't know
          </Button>
          <Button onClick={() => answer(true)}><Check className="h-4 w-4" /> Knew it</Button>
        </div>
      )}
    </div>
  );
}
