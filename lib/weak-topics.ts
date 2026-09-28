import { prisma } from '@/lib/prisma';
import { unpackQuestionMeta } from '@/lib/question-gen';

export interface WeakTopic {
  key: string;
  label: string;
  kind: 'course' | 'material' | 'concept';
  accuracyPct: number;
  answered: number;
  correct: number;
  materialId?: string;
  courseId?: string;
}

const MIN_SAMPLE = 2;

/**
 * Aggregates graded CBT answers by concept topic (from packed meta), then by
 * course/material. Weakest first — used for adaptive drill and dashboard.
 */
export async function getWeakTopics(userId: string, limit = 8): Promise<WeakTopic[]> {
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
          course: { select: { code: true, title: true } },
          material: { select: { originalName: true } },
        },
      },
    },
    take: 2000,
  });

  type Bucket = {
    label: string;
    kind: 'course' | 'material' | 'concept';
    points: number;
    awarded: number;
    count: number;
    correct: number;
    materialId?: string;
    courseId?: string;
  };
  const buckets = new Map<string, Bucket>();

  for (const a of answers) {
    const { courseId, materialId, course, material } = a.attempt;
    const meta = unpackQuestionMeta(a.explanation);
    const topicLabel = meta.topic && meta.topic !== 'General' ? meta.topic : null;

    if (topicLabel) {
      const ckey = `concept:${topicLabel.toLowerCase()}`;
      const cb = buckets.get(ckey) ?? {
        label: topicLabel,
        kind: 'concept' as const,
        points: 0,
        awarded: 0,
        count: 0,
        correct: 0,
        materialId: materialId ?? undefined,
        courseId: courseId ?? undefined,
      };
      cb.points += a.points;
      cb.awarded += a.awarded;
      cb.count += 1;
      if (a.isCorrect) cb.correct += 1;
      if (!cb.materialId && materialId) cb.materialId = materialId;
      if (!cb.courseId && courseId) cb.courseId = courseId;
      buckets.set(ckey, cb);
    }

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

    const bucket = buckets.get(key) ?? { label, kind, points: 0, awarded: 0, count: 0, correct: 0 };
    bucket.points += a.points;
    bucket.awarded += a.awarded;
    bucket.count += 1;
    if (a.isCorrect) bucket.correct += 1;
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
      correct: b.correct,
      materialId: b.materialId,
      courseId: b.courseId,
    }))
    .sort((a, b) => a.accuracyPct - b.accuracyPct || b.answered - a.answered);

  return topics.slice(0, limit);
}

/** Concept labels only, weakest first — for adaptive sampling. */
export async function getWeakConceptLabels(userId: string, limit = 10): Promise<string[]> {
  const all = await getWeakTopics(userId, 20);
  return all.filter((t) => t.kind === 'concept' && t.accuracyPct < 70).map((t) => t.label).slice(0, limit);
}
