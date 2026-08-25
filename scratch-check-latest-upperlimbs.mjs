import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const attempt = await prisma.examSession.findUnique({
  where: { id: 'cmt92h05k002xft2jokwxqir8' },
  select: { id: true, materialId: true, startedAt: true, questionIds: true },
});
console.log('Attempt started:', attempt.startedAt.toISOString());
const ids = JSON.parse(attempt.questionIds).slice(0, 3);
const qs = await prisma.question.findMany({ where: { id: { in: ids } }, select: { createdAt: true, explanation: true } });
for (const q of qs) console.log(q.createdAt.toISOString(), (q.explanation||'').startsWith('[demo]') ? 'DEMO' : 'real');

const material = await prisma.material.findUnique({ where: { id: attempt.materialId }, select: { id: true, createdAt: true, originalName: true } });
console.log('Material:', material.id, material.originalName, 'uploaded', material.createdAt.toISOString());

const totalQs = await prisma.question.count({ where: { sourceId: material.id } });
const demoQs = await prisma.question.count({ where: { sourceId: material.id, explanation: { startsWith: '[demo]' } } });
console.log('Total saved questions for this material:', totalQs, '| demo-flagged:', demoQs);

await prisma.$disconnect();
