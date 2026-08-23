import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/api-guard';
import { generateQuestionsFromText, fallbackGenerate, type QuestionFormat, type GeneratedQuestion } from '@/lib/question-gen';
import { resolveAiProviders } from '@/lib/ai';
import { pointsFor } from '@/lib/cbt/constants';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';

export const maxDuration = 300;

const ALLOWED: QuestionFormat[] = ['MCQ', 'TRUE_FALSE', 'FILL_BLANK', 'THEORY'];

function toRow(q: GeneratedQuestion, materialId: string, authorId: string, demo: boolean) {
  return {
    type: q.type,
    question: q.question,
    options: q.options ? JSON.stringify(q.options) : null,
    answer: q.answer,
    explanation: demo ? `[demo] ${q.explanation ?? ''}`.trim() : q.explanation || null,
    points: pointsFor(q.type),
    sourceId: materialId,
    authorId,
  };
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ok, user, response } = await guard();
  if (!ok || !user) return response!;

  // The most expensive AI call in the app — a full two-stage analyze-then-
  // generate pipeline, potentially across multiple providers/chunks per
  // request. Cap per-user volume so it can't be looped into a large bill.
  const genLimit = await checkRateLimit(`question-gen:${user.userId}`, 60 * 60 * 1000, 15);
  if (!genLimit.ok) return rateLimitResponse(genLimit);

  const { id } = await params;

  const material = await prisma.material.findUnique({ where: { id } });
  if (!material) return NextResponse.json({ error: 'Material not found' }, { status: 404 });
  if (material.userId !== user.userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const rawFormats: string[] = body?.formats && Array.isArray(body.formats) ? body.formats : [];
  const formats: QuestionFormat[] = rawFormats.filter((f): f is QuestionFormat => (ALLOWED as string[]).includes(f));
  if (rawFormats.length > 0 && formats.length === 0) {
    return NextResponse.json({ error: 'Invalid formats. Use MCQ, TRUE_FALSE, FILL_BLANK or THEORY.' }, { status: 422 });
  }
  const requested = Math.max(Number(body?.count) || 2, 1);
  // Use the per-format count the client already computed (target / formats).
  // No arbitrary 50-question ceiling — generation is parallelized by format and
  // chunk so it stays within the serverless time budget even at 100 questions.
  const perFormatTarget = Math.min(requested, 100);
  const save = body?.save === true;

  if (!material.text || material.text.trim().length === 0) {
    return NextResponse.json({ error: 'This document has no readable text.' }, { status: 422 });
  }

  const providers = await resolveAiProviders(user.userId);

  // This route declares maxDuration = 300 above, so guard the whole generation
  // against *that* budget (minus headroom for the DB write that follows), not
  // an old Hobby-plan 60s assumption — the two-stage topic-analysis pipeline
  // legitimately needs several sequential AI calls at MAX_CONCURRENCY=1 (to
  // respect Groq's tight per-minute token budget), which routinely took
  // longer than 55s and was silently forcing every request into the demo
  // fallback even with a real API key configured. Verified against production:
  // real generation was completing around 90-150s for a 25-question request.
  //
  // Previously, hitting this timeout returned `saved: false` even when the
  // caller asked to save — so a caller like the PDF exam creator would then
  // try to start an exam against zero saved questions and fail with
  // "No questions have been generated". The fallback set is now persisted
  // (flagged `[demo]` in its explanation) whenever `save` was requested, so
  // `saved` always reflects what's actually in the database.
  const result = await Promise.race([
    generateQuestionsFromText(material.text, formats, perFormatTarget, providers),
    new Promise<{ questions: GeneratedQuestion[]; usedFallback: boolean }>((resolve) =>
      setTimeout(() => resolve({ questions: [], usedFallback: true }), 280000)
    ),
  ]);

  // generateQuestionsFromText already falls back internally (no key, provider
  // error, empty result) and returns usable questions in that case — only
  // regenerate here if the race timed out and truly nothing came back.
  const usedFallback = result.usedFallback;
  const generated = result.questions.length > 0 ? result.questions : fallbackGenerate(material.text, formats, perFormatTarget);

  if (generated.length === 0) {
    return NextResponse.json({ error: 'Could not generate any questions from this document.' }, { status: 422 });
  }

  let savedIds: string[] = [];
  if (save) {
    const created = await prisma.question.createManyAndReturn({
      data: generated.map((q) => toRow(q, material.id, user.userId, usedFallback)),
      select: { id: true },
    });
    savedIds = created.map((c) => c.id);
  }

  return NextResponse.json({
    questions: generated.map((q, i) => ({
      id: savedIds[i],
      type: q.type,
      question: q.question,
      options: q.options,
      answer: q.answer,
      explanation: q.explanation,
    })),
    count: generated.length,
    saved: save && savedIds.length === generated.length,
    usedFallback,
  });
}
