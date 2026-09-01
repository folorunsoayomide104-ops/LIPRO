import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/api-guard';
import { generateFlashcardsFromText, fallbackGenerate, type GeneratedFlashcard } from '@/lib/flashcard-gen';
import { resolveAiProviders, AI_FEATURES_ENABLED } from '@/lib/ai';

export const maxDuration = 300;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ok, user, response } = await guard();
  if (!ok || !user) return response!;

  if (!AI_FEATURES_ENABLED) {
    return NextResponse.json(
      { error: 'AI flashcard generation is temporarily disabled. Create flashcards manually instead.' },
      { status: 503 }
    );
  }

  const { id } = await params;

  const material = await prisma.material.findUnique({ where: { id } });
  if (!material) return NextResponse.json({ error: 'Material not found' }, { status: 404 });
  if (material.userId !== user.userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const requested = Math.max(Number(body?.count) || 12, 1);
  const count = Math.min(requested, 60);
  const save = body?.save === true;

  if (!material.text || material.text.trim().length === 0) {
    return NextResponse.json({ error: 'This document has no readable text.' }, { status: 422 });
  }

  const providers = await resolveAiProviders(user.userId);

  // Same reasoning as app/api/materials/[id]/questions/route.ts: this route
  // declares maxDuration = 300 above, so guard generation against that
  // budget (minus headroom), not a stale 60s assumption that was silently
  // forcing real requests into the demo fallback.
  const result = await Promise.race([
    generateFlashcardsFromText(material.text, count, providers),
    new Promise<{ cards: GeneratedFlashcard[]; usedFallback: boolean }>((resolve) =>
      setTimeout(() => resolve({ cards: [], usedFallback: true }), 280000)
    ),
  ]);

  const usedFallback = result.usedFallback;
  const generated = result.cards.length > 0 ? result.cards : fallbackGenerate(material.text, count);

  if (generated.length === 0) {
    return NextResponse.json({ error: 'Could not generate any flashcards from this document.' }, { status: 422 });
  }

  let savedIds: string[] = [];
  if (save) {
    const created = await prisma.flashcard.createManyAndReturn({
      data: generated.map((c) => ({
        front: c.front,
        back: usedFallback ? `[demo] ${c.back}`.trim() : c.back,
        materialId: material.id,
        courseId: material.courseId,
        userId: user.userId,
      })),
      select: { id: true },
    });
    savedIds = created.map((c) => c.id);
  }

  return NextResponse.json({
    cards: generated.map((c, i) => ({ id: savedIds[i], front: c.front, back: c.back })),
    count: generated.length,
    saved: save && savedIds.length === generated.length,
    usedFallback,
  });
}
