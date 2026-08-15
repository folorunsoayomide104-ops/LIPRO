/**
 * Single source of truth for CBT tunables. The launcher options used to be
 * duplicated (and divergent) between start-exam-button and pdf-exam-creator.
 */

export const QUESTION_COUNTS = [10, 25, 50, 100] as const;
export const DURATION_MINUTES = [10, 15, 30, 60, 90] as const;

export const MIN_DURATION_SEC = 60;
export const MAX_DURATION_SEC = 3 * 60 * 60;

/** Answers posted more than this long after the deadline are ignored. */
export const SUBMIT_GRACE_SEC = 15;

export const AUTOSAVE_DEBOUNCE_MS = 800;

/** Cap on simultaneously in-progress attempts per user. */
export const MAX_OPEN_ATTEMPTS = 5;

/** Graded by comparing meaning — needs AI (or the heuristic fallback). */
export const FREE_TEXT_TYPES = new Set(['THEORY', 'ESSAY', 'FILL_BLANK']);
/** Graded by exact match. */
export const OBJECTIVE_TYPES = new Set(['MCQ', 'TRUE_FALSE']);

export function isFreeText(type: string): boolean {
  return FREE_TEXT_TYPES.has(type);
}

/** Default marks per question type. Previously inlined in the generation route. */
export const POINTS_BY_TYPE: Record<string, number> = {
  MCQ: 2,
  TRUE_FALSE: 1,
  FILL_BLANK: 2,
  THEORY: 10,
  ESSAY: 10,
};

export function pointsFor(type: string): number {
  return POINTS_BY_TYPE[type] ?? 1;
}

/* Grading budget ---------------------------------------------------------- */

export const GRADE_BATCH_SIZE = 5;
export const GRADE_CONCURRENCY = 3;
/** Leaves headroom under the route's maxDuration of 300s. */
export const GRADE_BUDGET_MS = 240_000;
/** Per-answer cap sent to the model, to bound tokens. */
export const MAX_ANSWER_CHARS = 2000;
/** An attempt stuck in pending/grading longer than this is swept by cron. */
export const GRADE_STUCK_MS = 5 * 60 * 1000;
