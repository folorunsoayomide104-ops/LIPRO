'use client';
import { useMemo, useState } from 'react';
import { Layers, Plus, Sparkles, X, Check, RotateCcw, ChevronLeft } from 'lucide-react';
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
      <div className="min-h-dvh bg-studio-bg text-studio-fg">
        <div className="mx-auto w-full max-w-2xl px-4 py-6 md:px-8">
          <StudySession cards={studyCards} onExit={() => setMode('browse')} onReview={recordReview} />
        </div>
      </div>
    );
  }

  return (
    <div className="-mx-4 -mt-2 min-h-[calc(100dvh-4rem)] bg-studio-bg p-4 text-studio-fg md:p-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <div className="flex flex-wrap items-center justify-between gap-3 studio-rise">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-studio-subtle">Cards</p>
            <h1 className="mt-2 font-studio-display text-3xl tracking-tight md:text-4xl">Flip until it sticks.</h1>
            <p className="mt-2 max-w-lg text-sm leading-normal text-studio-muted">Generate cards from your documents, or add your own — then study them.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowAddForm((v) => !v)} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-studio-elevated px-3 text-xs font-medium text-studio-muted shadow-studio-border hover:text-studio-fg">
              <Plus className="h-4 w-4" /> Add card
            </button>
            <button type="button" onClick={() => setShowGenerate((v) => !v)} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-studio-primary px-3 text-xs font-medium text-studio-primary-fg">
              <Sparkles className="h-4 w-4" /> Generate from document
            </button>
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
          <div className="flex items-center justify-between rounded-xl bg-studio-surface p-5 shadow-studio-border studio-rise studio-rise-delay-1">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-studio-primary text-studio-primary-fg"><Layers className="h-5 w-5" /></span>
              <div>
                <div className="text-sm font-medium text-studio-fg">All cards</div>
                <div className="text-xs text-studio-subtle">{cards.length} card{cards.length === 1 ? '' : 's'} across every deck</div>
              </div>
            </div>
            <button type="button" onClick={() => startStudy('all')} className="inline-flex h-9 items-center rounded-full bg-studio-primary px-4 text-xs font-medium text-studio-primary-fg">Study all</button>
          </div>
        )}

        {decks.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-studio-border-strong py-16 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-studio-elevated text-studio-primary">
              <Layers className="h-6 w-6" />
            </div>
            <div>
              <p className="font-medium text-studio-fg">No flashcards yet</p>
              <p className="mt-1 text-sm text-studio-subtle">Generate a set from a document you&apos;ve already uploaded, or add one manually.</p>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {decks.map((deck) => (
              <div key={deck.key} className="group rounded-xl bg-studio-surface p-5 shadow-studio-border studio-rise studio-rise-delay-2">
                <span className="inline-flex rounded-full bg-studio-elevated px-2.5 py-1 text-[11px] font-medium text-studio-muted">{deck.cards.length} card{deck.cards.length === 1 ? '' : 's'}</span>
                <h3 className="mt-2 truncate font-studio-display text-lg tracking-tight text-studio-fg">{deck.label}</h3>
                <p className="text-xs text-studio-subtle">Study progress: {deck.cards.filter((c) => c.timesSeen > 0).length} of {deck.cards.length} reviewed</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {deck.cards.slice(0, 3).map((c) => (
                    <span key={c.id} className="max-w-[140px] truncate rounded-md bg-studio-elevated px-2 py-1 text-[11px] text-studio-muted">{c.front}</span>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <button type="button" onClick={() => startStudy(deck.key)} className="inline-flex h-8 items-center rounded-full bg-studio-primary px-3 text-xs font-medium text-studio-primary-fg">Study deck</button>
                  <div className="flex -space-x-1">
                    {deck.cards.slice(0, 4).map((c) => (
                      <button
                        key={c.id}
                        title={`Delete "${c.front}"`}
                        aria-label={`Delete card ${c.front}`}
                        onClick={() => removeCard(c.id)}
                        className="grid h-7 w-7 place-items-center rounded-full bg-studio-elevated text-studio-subtle opacity-0 shadow-studio-border transition-opacity hover:text-studio-danger group-hover:opacity-100"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
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
    <div className="rounded-xl bg-studio-surface p-5 shadow-studio-border">
      <h3 className="font-studio-display text-lg tracking-tight text-studio-fg">Add a flashcard</h3>
      <div className="mt-3 flex flex-col gap-2">
        <input
          value={front}
          onChange={(e) => setFront(e.target.value)}
          placeholder="Front — the question or term"
          className="h-11 w-full rounded-lg bg-studio-elevated px-4 text-sm text-studio-fg shadow-studio-border outline-none placeholder:text-studio-subtle"
        />
        <textarea
          value={back}
          onChange={(e) => setBack(e.target.value)}
          placeholder="Back — the answer"
          rows={2}
          className="w-full resize-none rounded-lg bg-studio-elevated px-4 py-3 text-sm text-studio-fg shadow-studio-border outline-none placeholder:text-studio-subtle"
        />
        {error && <p className="text-xs text-studio-danger">{error}</p>}
        <div className="flex gap-2">
          <button type="button" onClick={submit} disabled={loading || !front.trim() || !back.trim()} className="inline-flex h-9 items-center rounded-full bg-studio-primary px-4 text-xs font-medium text-studio-primary-fg disabled:opacity-50">
            {loading ? 'Saving…' : 'Save card'}
          </button>
          <button type="button" onClick={onCancel} className="inline-flex h-9 items-center rounded-full px-4 text-xs font-medium text-studio-subtle hover:text-studio-fg">Cancel</button>
        </div>
      </div>
    </div>
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
      <div className="rounded-xl bg-studio-surface p-5 shadow-studio-border">
        <p className="text-sm text-studio-muted">Upload a document in LIPRO AI or the CBT PDF tool first — flashcards generate from a document&apos;s text.</p>
        <button type="button" onClick={onCancel} className="mt-3 inline-flex h-9 items-center rounded-full px-4 text-xs font-medium text-studio-subtle hover:text-studio-fg">Close</button>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-studio-surface p-5 shadow-studio-border">
      <h3 className="font-studio-display text-lg tracking-tight text-studio-fg">Generate flashcards from a document</h3>
      <div className="mt-3 flex flex-col gap-3">
        <select
          value={materialId}
          onChange={(e) => setMaterialId(e.target.value)}
          className="h-11 w-full rounded-lg bg-studio-elevated px-4 text-sm text-studio-fg shadow-studio-border outline-none"
        >
          {materials.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <div className="flex items-center gap-3">
          <label className="text-xs text-studio-subtle">Number of cards</label>
          <input
            type="number"
            min={4}
            max={60}
            value={count}
            onChange={(e) => setCount(Math.max(4, Math.min(60, Number(e.target.value) || 12)))}
            className="h-9 w-20 rounded-md bg-studio-elevated px-3 text-sm text-studio-fg shadow-studio-border outline-none"
          />
        </div>
        {error && <p className="text-xs text-studio-danger">{error}</p>}
        <div className="flex gap-2">
          <button type="button" onClick={submit} disabled={loading} className="inline-flex h-9 items-center rounded-full bg-studio-primary px-4 text-xs font-medium text-studio-primary-fg disabled:opacity-50">
            {loading ? 'Generating…' : 'Generate'}
          </button>
          <button type="button" onClick={onCancel} className="inline-flex h-9 items-center rounded-full px-4 text-xs font-medium text-studio-subtle hover:text-studio-fg">Cancel</button>
        </div>
      </div>
    </div>
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
        <button type="button" onClick={onExit} className="inline-flex h-9 items-center gap-1 rounded-full px-3 text-xs font-medium text-studio-subtle hover:text-studio-fg"><ChevronLeft className="h-4 w-4" /> Back</button>
        <p className="text-sm text-studio-muted">This deck has no cards.</p>
      </div>
    );
  }

  if (index >= cards.length) {
    const total = done.known + done.unknown;
    return (
      <div className="mx-auto flex max-w-md flex-col items-center py-16 text-center">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-studio-subtle">Deck done</p>
        <h2 className="mt-3 font-studio-display text-4xl tracking-tight text-studio-fg">That&rsquo;s the set.</h2>
        <p className="mt-3 text-sm text-studio-muted">You knew {done.known} of {total} cards.</p>
        <div className="mt-8 flex justify-center gap-2">
          <button type="button" onClick={() => { setIndex(0); setDone({ known: 0, unknown: 0 }); }} className="inline-flex h-10 items-center gap-1.5 rounded-full bg-studio-elevated px-4 text-sm font-medium text-studio-muted shadow-studio-border hover:text-studio-fg">
            <RotateCcw className="h-4 w-4" /> Study again
          </button>
          <button type="button" onClick={onExit} className="inline-flex h-10 items-center rounded-full bg-studio-primary px-4 text-sm font-medium text-studio-primary-fg">Done</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <button type="button" onClick={onExit} className="inline-flex h-9 items-center gap-1 rounded-full px-3 text-xs font-medium text-studio-subtle hover:text-studio-fg"><ChevronLeft className="h-4 w-4" /> Exit</button>
        <span className="font-studio-mono text-xs tabular-nums text-studio-subtle">{index + 1} / {cards.length}</span>
      </div>

      <div className="h-1 overflow-hidden rounded-full bg-studio-elevated">
        <div
          className="h-full rounded-full bg-studio-primary transition-[width] duration-200"
          style={{ width: `${((index + (flipped ? 0.5 : 0)) / cards.length) * 100}%` }}
        />
      </div>

      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        aria-label={flipped ? 'Show question' : 'Show answer'}
        className="flex min-h-[320px] w-full flex-col justify-center rounded-xl bg-studio-surface px-6 py-10 text-left shadow-studio-border transition-colors md:px-10"
      >
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-studio-subtle">{flipped ? 'Answer' : 'Prompt'}</p>
        {flipped ? (
          <p className="mt-4 whitespace-pre-wrap text-base leading-relaxed text-studio-fg md:text-lg">{card.back}</p>
        ) : (
          <p className="mt-4 font-studio-display text-2xl leading-snug tracking-tight text-studio-fg md:text-3xl">{card.front}</p>
        )}
        <p className="mt-8 text-xs text-studio-subtle">{flipped ? 'Tap to see prompt' : 'Tap to flip'}</p>
      </button>

      {flipped && (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => answer(false)} className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full bg-studio-elevated text-sm font-medium text-studio-muted shadow-studio-border hover:text-studio-fg">
            <X className="h-4 w-4" /> Again
          </button>
          <button type="button" onClick={() => answer(true)} className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full bg-studio-primary text-sm font-medium text-studio-primary-fg">
            <Check className="h-4 w-4" /> Got it
          </button>
        </div>
      )}
    </div>
  );
}
