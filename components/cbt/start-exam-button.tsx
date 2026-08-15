'use client';
import { ExamLauncher } from '@/components/cbt/exam-launcher';

export function StartExamButton({ courseId }: { courseId: string }) {
  return <ExamLauncher source={{ kind: 'course', id: courseId }} defaultMode="practice" />;
}
