import type { ReviewItem } from '@/lib/cbt/serialize';
import type { QuestionDifficulty } from '@/lib/question-gen';

export type ConceptMastery = {
  topic: string;
  answered: number;
  correct: number;
  points: number;
  awarded: number;
  accuracyPct: number;
  /** easy | medium | hard breakdown of items in this topic */
  byDifficulty: Partial<Record<QuestionDifficulty, { answered: number; correct: number }>>;
};

/**
 * Pure aggregation of a single completed attempt into concept-level mastery.
 * Topics come from packed meta (Phase A). No DB access — safe for client + server.
 */
export function aggregateConceptMastery(items: ReviewItem[]): ConceptMastery[] {
  type Bucket = {
    answered: number;
    correct: number;
    points: number;
    awarded: number;
    byDifficulty: Partial<Record<QuestionDifficulty, { answered: number; correct: number }>>;
  };
  const map = new Map<string, Bucket>();

  for (const it of items) {
    const topic = (it.topic || 'General').trim() || 'General';
    const key = topic.toLowerCase();
    const b = map.get(key) ?? {
      answered: 0,
      correct: 0,
      points: 0,
      awarded: 0,
      byDifficulty: {},
    };
    b.answered += 1;
    b.points += it.points || 0;
    b.awarded += it.awarded ?? 0;
    if (it.isCorrect) b.correct += 1;

    const d = it.difficulty;
    if (d === 'easy' || d === 'medium' || d === 'hard') {
      const db = b.byDifficulty[d] ?? { answered: 0, correct: 0 };
      db.answered += 1;
      if (it.isCorrect) db.correct += 1;
      b.byDifficulty[d] = db;
    }
    map.set(key, b);
  }

  // Preserve original casing from first occurrence
  const labelByKey = new Map<string, string>();
  for (const it of items) {
    const topic = (it.topic || 'General').trim() || 'General';
    const key = topic.toLowerCase();
    if (!labelByKey.has(key)) labelByKey.set(key, topic);
  }

  return Array.from(map.entries())
    .map(([key, b]) => ({
      topic: labelByKey.get(key) || key,
      answered: b.answered,
      correct: b.correct,
      points: b.points,
      awarded: b.awarded,
      accuracyPct: b.points > 0 ? Math.round((b.awarded / b.points) * 100) : 0,
      byDifficulty: b.byDifficulty,
    }))
    .sort((a, b) => a.accuracyPct - b.accuracyPct || b.answered - a.answered);
}

/** Topics with accuracy below threshold — for the mastery-path CTA. */
export function weakConceptsFromAttempt(items: ReviewItem[], threshold = 70): string[] {
  return aggregateConceptMastery(items)
    .filter((c) => c.topic !== 'General' && c.accuracyPct < threshold && c.answered >= 1)
    .map((c) => c.topic);
}
