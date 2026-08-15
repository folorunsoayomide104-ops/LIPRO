import type { ExamAnswer } from '@prisma/client';

/**
 * The answer-leak boundary. Anything sent to a student mid-attempt goes through
 * `toStudentItem`; correct answers and explanations are only ever attached once
 * the item has been explicitly revealed (practice "Check answer") or the attempt
 * is finished.
 */

function parseOptions(optionsJson: string | null): string[] | null {
  if (!optionsJson) return null;
  try {
    const parsed = JSON.parse(optionsJson);
    return Array.isArray(parsed) ? parsed.map((o) => String(o)) : null;
  } catch {
    return null;
  }
}

export type StudentItem = {
  itemId: string;
  orderIndex: number;
  type: string;
  prompt: string;
  options: string[] | null;
  imageUrl: string | null;
  points: number;
  response: string | null;
  revealed: boolean;
  // Present only when revealed (practice mode).
  correctAnswer?: string;
  explanation?: string | null;
  feedback?: string | null;
  isCorrect?: boolean | null;
  awarded?: number;
};

export function toStudentItem(item: ExamAnswer): StudentItem {
  const base: StudentItem = {
    itemId: item.id,
    orderIndex: item.orderIndex,
    type: item.type,
    prompt: item.prompt,
    options: parseOptions(item.optionsJson),
    imageUrl: item.imageUrl,
    points: item.points,
    response: item.response,
    revealed: item.revealed,
  };

  if (!item.revealed) return base;

  return {
    ...base,
    correctAnswer: item.correctAnswer,
    explanation: item.explanation,
    feedback: item.feedback,
    isCorrect: item.isCorrect,
    awarded: item.awarded,
  };
}

export type ReviewItem = StudentItem & {
  correctAnswer: string;
  explanation: string | null;
  feedback: string | null;
  isCorrect: boolean | null;
  awarded: number;
  isGraded: boolean;
  gradeMethod: string | null;
  confidence: number | null;
  overridden: boolean;
  overrideNote: string | null;
};

/** Full detail — only for a completed attempt's results page. */
export function toReviewItem(item: ExamAnswer): ReviewItem {
  return {
    itemId: item.id,
    orderIndex: item.orderIndex,
    type: item.type,
    prompt: item.prompt,
    options: parseOptions(item.optionsJson),
    imageUrl: item.imageUrl,
    points: item.points,
    response: item.response,
    revealed: item.revealed,
    correctAnswer: item.correctAnswer,
    explanation: item.explanation,
    feedback: item.feedback,
    isCorrect: item.isCorrect,
    awarded: item.awarded,
    isGraded: item.isGraded,
    gradeMethod: item.gradeMethod,
    confidence: item.confidence,
    overridden: !!item.overriddenBy,
    overrideNote: item.overrideNote,
  };
}

/** Question-bank projection for student-facing reads: no answer, no explanation. */
export const PUBLIC_QUESTION_SELECT = {
  id: true,
  courseId: true,
  sourceId: true,
  type: true,
  question: true,
  options: true,
  imageUrl: true,
  points: true,
  createdAt: true,
} as const;

export function percentage(score: number | null, total: number | null): number {
  if (!total || total <= 0 || score == null) return 0;
  return Math.round((score / total) * 100);
}
