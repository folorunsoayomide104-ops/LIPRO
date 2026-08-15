'use client';

/**
 * Client-side helper for starting an exam attempt. Used by both the exam
 * launcher and the PDF-to-exam creator so there's exactly one
 * "POST → navigate" code path instead of the two divergent copies that used
 * to live in start-exam-button and pdf-exam-creator.
 */

export type AttemptSource = { kind: 'course'; id: string } | { kind: 'material'; id: string };

export interface CreateAttemptParams {
  source: AttemptSource;
  mode: 'practice' | 'exam';
  count: number;
  durationSec?: number;
}

export interface CreateAttemptResult {
  attemptId: string;
  mode: 'practice' | 'exam';
  count: number;
  totalPoints: number;
  durationSec: number | null;
  deadlineAt: string | null;
  sourceTitle: string;
}

export async function createAttempt(params: CreateAttemptParams): Promise<CreateAttemptResult> {
  const body: Record<string, unknown> = {
    mode: params.mode,
    count: params.count,
    ...(params.source.kind === 'course' ? { courseId: params.source.id } : { materialId: params.source.id }),
  };
  if (params.mode === 'exam' && params.durationSec) body.durationSec = params.durationSec;

  const res = await fetch('/api/cbt/attempts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || 'Could not start this exam');
  return data as CreateAttemptResult;
}
