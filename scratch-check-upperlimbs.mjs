import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const attempt = await prisma.examSession.findUnique({
  where: { id: 'cmt9084ws0002g5t5cs7gcuo9' },
  select: { id: true, materialId: true, startedAt: true, questionIds: true },
});
console.log('Attempt started:', attempt.startedAt.toISOString());
const ids = JSON.parse(attempt.questionIds).slice(0, 3);
const qs = await prisma.question.findMany({
  where: { id: { in: ids } },
  select: { createdAt: true, explanation: true },
});
for (const q of qs) console.log(q.createdAt.toISOString(), (q.explanation||'').startsWith('[demo]') ? 'DEMO' : 'real');

const material = await prisma.material.findUnique({ where: { id: attempt.materialId }, select: { createdAt: true, originalName: true } });
console.log('Material uploaded:', material.createdAt.toISOString(), material.originalName);

await prisma.$disconnect();
