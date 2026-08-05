import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/api-guard';
import { generateQuestionsFromText, type QuestionFormat } from '@/lib/question-gen';
import { resolveAiProvider } from '@/lib/ai';

export const maxDuration = 300;

const ALLOWED: QuestionFormat[] = ['MCQ', 'TRUE_FALSE', 'FILL_BLANK', 'THEORY'];

const POINTS: Record<QuestionFormat, number> = {
  MCQ: 2,
  TRUE_FALSE: 1,
  FILL_BLANK: 2,
  THEORY: 10,
};

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ok, user, response } = await guard();
  if (!ok || !user) return response!;
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
  // Keep the total request within serverless limits: no more than 50 total questions.
  const perFormatTarget = Math.min(requested, Math.ceil(50 / Math.max(formats.length, 1)));
  const save = body?.save === true;

  if (!material.text || material.text.trim().length === 0) {
    return NextResponse.json({ error: 'This document has no readable text.' }, { status: 422 });
  }

  const provider = await resolveAiProvider(user.userId);
  const result = await generateQuestionsFromText(material.text, formats, perFormatTarget, provider);
  const generated = result.questions;
  if (!generated || generated.length === 0) {
    return NextResponse.json({ error: 'No questions could be generated from this document.' }, { status: 422 });
  }

  if (save) {
    await prisma.question.createMany({
      data: generated.map((q) => ({
        type: q.type,
        question: q.question,
        options: q.options ? JSON.stringify(q.options) : null,
        answer: q.answer,
        explanation: q.explanation || null,
        points: POINTS[q.type] ?? 2,
        sourceId: material.id,
        authorId: user.userId,
      })),
    });
  }

  return NextResponse.json({
    questions: generated.map((q) => ({
      type: q.type,
      question: q.question,
      options: q.options,
      answer: q.answer,
      explanation: q.explanation,
    })),
    count: generated.length,
    saved: save,
    usedFallback: result.usedFallback,
  });
}
