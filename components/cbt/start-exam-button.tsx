'use client';
import { ExamLauncher } from '@/components/cbt/exam-launcher';
import type { QuestionFormat } from '@/lib/question-gen';

export function StartExamButton({ courseId, typeCounts }: { courseId: string; typeCounts?: Partial<Record<QuestionFormat, number>> }) {
  return <ExamLauncher source={{ kind: 'course', id: courseId }} defaultMode="practice" typeCounts={typeCounts} />;
}
