import { prisma } from '@/lib/prisma';
import { unpackQuestionMeta } from '@/lib/question-gen';

export type DueReview = {
  key: string;
  label: string;
  accuracyPct: number;
  answered: number;
  /** Days since last graded answer on this concept */
  daysSince: number;
  /** Suggested interval in days based on accuracy */
  intervalDays: number;
  /** true when daysSince >= intervalDays */
  isDue: boolean;
  materialId?: string;
  courseId?: string;
};

/**
 * Simple spaced intervals from accuracy (no SM-2 table required):
 *  <40% → 1 day
 *  40–59% → 2 days
 *  60–74% → 4 days
 *  75–89% → 7 days
 *  ≥90% → 14 days
 */
function intervalForAccuracy(pct: number): number {
  if (pct < 40) return 1;
  if (pct < 60) return 2;
  if (pct < 75) return 4;
  if (pct < 90) return 7;
  return 14;
}

/**
 * Concept-level "due for review" list from graded CBT history.
 * No new tables — uses existing examAnswer + packed topic meta.
 */
export async function getDueReviews(userId: string, limit = 8): Promise<DueReview[]> {
  const answers = await prisma.examAnswer.findMany({
    where: {
      isGraded: true,
      attempt: { userId, status: 'completed' },
    },
    select: {
      points: true,
      awarded: true,
      isCorrect: true,
      explanation: true,
      attempt: {
        select: {
          courseId: true,
          materialId: true,
          startedAt: true,
        },
      },
    },
    take: 2000,
  });

  type Bucket = {
    label: string;
    points: number;
    awarded: number;
    count: number;
    lastAt: number;
    materialId?: string;
    courseId?: string;
  };
  const buckets = new Map<string, Bucket>();
  const now = Date.now();

  for (const a of answers) {
    const meta = unpackQuestionMeta(a.explanation);
    const topicLabel = meta.topic && meta.topic !== 'General' ? meta.topic : null;
    if (!topicLabel) continue;

    const key = `concept:${topicLabel.toLowerCase()}`;
    const raw = a.attempt.startedAt;
    const at = raw instanceof Date ? raw.getTime() : new Date(raw).getTime();

    const b = buckets.get(key) ?? {
      label: topicLabel,
      points: 0,
      awarded: 0,
      count: 0,
      lastAt: 0,
      materialId: a.attempt.materialId ?? undefined,
      courseId: a.attempt.courseId ?? undefined,
    };
    b.points += a.points;
    b.awarded += a.awarded;
    b.count += 1;
    if (at > b.lastAt) b.lastAt = at;
    if (!b.materialId && a.attempt.materialId) b.materialId = a.attempt.materialId;
    if (!b.courseId && a.attempt.courseId) b.courseId = a.attempt.courseId;
    buckets.set(key, b);
  }

  const MS_DAY = 86_400_000;
  const rows: DueReview[] = [];

  for (const [key, b] of buckets) {
    if (b.count < 1 || b.points <= 0) continue;
    const accuracyPct = Math.round((b.awarded / b.points) * 100);
    const intervalDays = intervalForAccuracy(accuracyPct);
    const daysSince = b.lastAt > 0 ? Math.floor((now - b.lastAt) / MS_DAY) : 999;
    const isDue = daysSince >= intervalDays;
    rows.push({
      key,
      label: b.label,
      accuracyPct,
      answered: b.count,
      daysSince,
      intervalDays,
      isDue,
      materialId: b.materialId,
      courseId: b.courseId,
    });
  }

  // Due first, then lowest accuracy, then longest overdue
  rows.sort((a, b) => {
    if (a.isDue !== b.isDue) return a.isDue ? -1 : 1;
    if (a.accuracyPct !== b.accuracyPct) return a.accuracyPct - b.accuracyPct;
    return b.daysSince - a.daysSince;
  });

  return rows.slice(0, limit);
}
