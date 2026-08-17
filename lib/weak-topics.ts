import { prisma } from '@/lib/prisma';

export interface WeakTopic {
  key: string;
  label: string;
  kind: 'course' | 'material';
  accuracyPct: number;
  answered: number;
  correct: number;
}

const MIN_SAMPLE = 3;

/**
 * Aggregates a student's graded CBT answers by course (or, for document-based
 * sessions with no course, by material) and returns the weakest topics first.
 * Uses points-weighted accuracy (awarded/points) rather than a plain correct
 * count so partially-graded THEORY/ESSAY answers are reflected proportionally.
 */
export async function getWeakTopics(userId: string, limit = 5): Promise<WeakTopic[]> {
  const answers = await prisma.examAnswer.findMany({
    where: {
      isGraded: true,
      attempt: { userId, status: 'completed' },
    },
    select: {
      points: true,
      awarded: true,
      attempt: {
        select: {
          courseId: true,
          materialId: true,
          course: { select: { code: true, title: true } },
          material: { select: { originalName: true } },
        },
      },
    },
  });

  const buckets = new Map<string, { label: string; kind: 'course' | 'material'; points: number; awarded: number; count: number }>();

  for (const a of answers) {
    const { courseId, materialId, course, material } = a.attempt;
    let key: string;
    let label: string;
    let kind: 'course' | 'material';
    if (courseId && course) {
      key = `course:${courseId}`;
      label = `${course.code} — ${course.title}`;
      kind = 'course';
    } else if (materialId && material) {
      key = `material:${materialId}`;
      label = material.originalName;
      kind = 'material';
    } else {
      continue;
    }

    const bucket = buckets.get(key) ?? { label, kind, points: 0, awarded: 0, count: 0 };
    bucket.points += a.points;
    bucket.awarded += a.awarded;
    bucket.count += 1;
    buckets.set(key, bucket);
  }

  const topics: WeakTopic[] = Array.from(buckets.entries())
    .filter(([, b]) => b.count >= MIN_SAMPLE && b.points > 0)
    .map(([key, b]) => ({
      key,
      label: b.label,
      kind: b.kind,
      accuracyPct: Math.round((b.awarded / b.points) * 100),
      answered: b.count,
      correct: Math.round((b.awarded / b.points) * b.count),
    }))
    .sort((a, b) => a.accuracyPct - b.accuracyPct);

  return topics.slice(0, limit);
}
