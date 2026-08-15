import { prisma } from '@/lib/prisma';

/**
 * Unbiased shuffle. The previous implementation used
 * `sort(() => Math.random() - 0.5)`, whose comparator is inconsistent and
 * produces a skewed distribution.
 */
export function fisherYates<T>(input: readonly T[]): T[] {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export type SampledQuestion = {
  id: string;
  type: string;
  question: string;
  options: string | null;
  answer: string;
  explanation: string | null;
  imageUrl: string | null;
  points: number;
};

/**
 * Pick `count` random questions matching `where`.
 *
 * Fetches ids only before sampling, so we don't pull an entire question bank
 * into memory just to slice it (which is what the old exam route did).
 */
export async function sampleQuestions(
  where: Record<string, unknown>,
  count: number
): Promise<SampledQuestion[]> {
  const ids = await prisma.question.findMany({ where, select: { id: true } });
  if (ids.length === 0) return [];

  const chosen = fisherYates(ids.map((q) => q.id)).slice(0, Math.min(count, ids.length));

  const rows = await prisma.question.findMany({
    where: { id: { in: chosen } },
    select: {
      id: true,
      type: true,
      question: true,
      options: true,
      answer: true,
      explanation: true,
      imageUrl: true,
      points: true,
    },
  });

  // Prisma does not preserve the order of an `in` filter — restore the shuffle.
  const byId = new Map(rows.map((r) => [r.id, r]));
  return chosen.map((id) => byId.get(id)).filter((q): q is SampledQuestion => !!q);
}

/**
 * Shuffle an MCQ's options for this attempt.
 *
 * `Question.answer` stores the option *text*, so reordering is normally safe.
 * If the answer isn't among the options (e.g. a generated question that stored
 * "A" against prose options), the original order is kept — reordering there
 * would make the question unanswerable.
 */
export function shuffleOptions(optionsJson: string | null, answer: string): string | null {
  if (!optionsJson) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(optionsJson);
  } catch {
    return optionsJson;
  }
  if (!Array.isArray(parsed) || parsed.length < 2) return optionsJson;

  const options = parsed.map((o) => String(o));
  const normalized = answer.trim().toLowerCase();
  if (!options.some((o) => o.trim().toLowerCase() === normalized)) return optionsJson;

  return JSON.stringify(fisherYates(options));
}
