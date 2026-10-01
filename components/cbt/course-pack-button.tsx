'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Package, Loader2 } from 'lucide-react';
import { createAttempt } from '@/lib/cbt/client';

/**
 * One-tap course pack: mixed formats, exam-style count, optional timer.
 * Uses existing question bank — no schema change.
 */
export function CoursePackButton({
  courseId,
  questionCount,
}: {
  courseId: string;
  questionCount: number;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (questionCount < 5) return null;

  const start = async () => {
    setLoading(true);
    setError('');
    try {
      const count = Math.min(30, Math.max(15, Math.min(questionCount, 25)));
      const result = await createAttempt({
        source: { kind: 'course', id: courseId },
        mode: 'exam',
        count,
        durationSec: Math.max(15, Math.round(count * 1.2)) * 60,
      });
      router.push(`/cbt/${result.attemptId}`);
    } catch (err: any) {
      setError(err?.message || 'Could not start pack');
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={start}
        disabled={loading}
        className="inline-flex h-9 items-center gap-1.5 rounded-full bg-studio-elevated px-3.5 text-xs font-semibold text-studio-primary shadow-studio-border disabled:opacity-50"
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Package className="h-3.5 w-3.5" />}
        Full course pack
      </button>
      {error && <p className="text-[11px] text-studio-danger">{error}</p>}
    </div>
  );
}
