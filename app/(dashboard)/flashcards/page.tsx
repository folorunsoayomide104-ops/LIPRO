import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { FlashcardsClient } from '@/components/dashboard/flashcards-client';

export default async function FlashcardsPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const [cards, materials] = await Promise.all([
    prisma.flashcard.findMany({
      where: { userId: session.userId },
      include: {
        course: { select: { id: true, code: true, title: true } },
        material: { select: { id: true, originalName: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.material.findMany({
      where: { userId: session.userId, text: { not: null } },
      select: { id: true, originalName: true },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
  ]);

  return (
    <FlashcardsClient
      initialCards={cards.map((c) => ({
        id: c.id,
        front: c.front,
        back: c.back,
        timesSeen: c.timesSeen,
        timesCorrect: c.timesCorrect,
        courseCode: c.course?.code ?? null,
        materialName: c.material?.originalName ?? null,
        materialId: c.materialId,
      }))}
      materials={materials.map((m) => ({ id: m.id, name: m.originalName }))}
    />
  );
}
