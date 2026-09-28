import { prisma } from '@/lib/prisma';
import { unpackQuestionMeta } from '@/lib/question-gen';

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
 * Pick `count` questions matching `where`.
 * When `preferTopics` is set, ~60% of the paper prefers matching weak concepts.
 */
export async function sampleQuestions(
  where: Record<string, unknown>,
  count: number,
  preferTopics?: string[]
): Promise<SampledQuestion[]> {
  const rows = await prisma.question.findMany({
    where,
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
  if (rows.length === 0) return [];

  const normalizedPrefer = (preferTopics || []).map((t) => t.toLowerCase().trim()).filter(Boolean);

  if (normalizedPrefer.length === 0 || count <= 1) {
    return fisherYates(rows).slice(0, Math.min(count, rows.length));
  }

  const preferred: typeof rows = [];
  const rest: typeof rows = [];
  for (const r of rows) {
    const topic = (unpackQuestionMeta(r.explanation).topic || '').toLowerCase();
    if (topic && normalizedPrefer.some((p) => topic.includes(p) || p.includes(topic))) {
      preferred.push(r);
    } else {
      rest.push(r);
    }
  }

  const preferCount = Math.min(preferred.length, Math.max(1, Math.ceil(count * 0.6)));
  const fromPrefer = fisherYates(preferred).slice(0, preferCount);
  const need = count - fromPrefer.length;
  const fromRest = fisherYates(rest).slice(0, Math.max(0, need));
  const used = new Set([...fromPrefer, ...fromRest].map((q) => q.id));
  const fill = fisherYates(rows.filter((r) => !used.has(r.id))).slice(0, Math.max(0, count - used.size));

  return fisherYates([...fromPrefer, ...fromRest, ...fill]).slice(0, count);
}

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
