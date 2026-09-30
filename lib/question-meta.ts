export type QuestionDifficulty = 'easy' | 'medium' | 'hard';

/** Pack difficulty + topic into explanation for DB storage without a schema migration. */
export function packQuestionMeta(explanation: string, difficulty: QuestionDifficulty, topic: string): string {
  const meta = JSON.stringify({ d: difficulty, t: topic.slice(0, 80) });
  const body = explanation.replace(/^\u00a7META\u00a7.*?\u00a7\u00a7\s*/s, '').trim();
  return `\u00a7META\u00a7${meta}\u00a7\u00a7 ${body}`.trim();
}

/** Unpack meta from a stored explanation (or plain explanation). */
export function unpackQuestionMeta(explanation: string | null | undefined): {
  explanation: string;
  difficulty: QuestionDifficulty | null;
  topic: string | null;
} {
  if (!explanation) return { explanation: '', difficulty: null, topic: null };
  const m = explanation.match(/^\u00a7META\u00a7(.+?)\u00a7\u00a7\s*([\s\S]*)$/);
  if (!m) return { explanation, difficulty: null, topic: null };
  try {
    const parsed = JSON.parse(m[1]);
    const d = parsed?.d;
    const difficulty: QuestionDifficulty | null =
      d === 'easy' || d === 'medium' || d === 'hard' ? d : null;
    const topic = typeof parsed?.t === 'string' && parsed.t.trim() ? parsed.t.trim() : null;
    return { explanation: (m[2] || '').trim(), difficulty, topic };
  } catch {
    return { explanation, difficulty: null, topic: null };
  }
}
