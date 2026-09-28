'use client';

export type AttemptSource = { kind: 'course'; id: string } | { kind: 'material'; id: string };

export interface CreateAttemptParams {
  source: AttemptSource;
  mode: 'practice' | 'exam';
  count: number;
  durationSec?: number;
  types?: string[];
  adaptive?: boolean;
}

export interface CreateAttemptResult {
  attemptId: string;
  mode: 'practice' | 'exam';
  count: number;
  totalPoints: number;
  durationSec: number | null;
  deadlineAt: string | null;
  sourceTitle: string;
  adaptive?: boolean;
}

export async function createAttempt(params: CreateAttemptParams): Promise<CreateAttemptResult> {
  const body: Record<string, unknown> = {
    mode: params.mode,
    count: params.count,
    ...(params.source.kind === 'course' ? { courseId: params.source.id } : { materialId: params.source.id }),
  };
  if (params.mode === 'exam' && params.durationSec) body.durationSec = params.durationSec;
  if (params.types?.length) body.types = params.types;
  if (params.adaptive) body.adaptive = true;

  const res = await fetch('/api/cbt/attempts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || 'Could not start this exam');
  return data as CreateAttemptResult;
}
