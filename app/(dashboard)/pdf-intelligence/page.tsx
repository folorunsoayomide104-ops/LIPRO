import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { PdfIntelligence } from '@/components/pdf/pdf-intelligence';

export default async function PdfIntelligencePage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const materials = await prisma.material.findMany({
    where: { userId: session.userId },
    include: { _count: { select: { questions: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <PdfIntelligence
      initialMaterials={materials.map((m) => ({
        id: m.id,
        originalName: m.originalName,
        mimeType: m.mimeType,
        sizeBytes: m.sizeBytes,
        status: m.status,
        createdAt: m.createdAt.toISOString(),
        questionCount: m._count.questions,
      }))}
    />
  );
}
