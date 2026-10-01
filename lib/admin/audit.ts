import { prisma } from '@/lib/prisma';

/**
 * Lightweight admin audit trail without a new table.
 * Writes a Notification with type=AUDIT to the acting admin (and optionally all admins).
 */
export async function logAdminAudit(params: {
  actorUserId: string;
  actorEmail?: string;
  action: string;
  detail: string;
  broadcast?: boolean;
}) {
  const title = `Audit · ${params.action}`;
  const message = [
    params.actorEmail ? `By ${params.actorEmail}` : `By ${params.actorUserId}`,
    params.detail,
    new Date().toISOString(),
  ].join(' · ');

  const targets: string[] = [params.actorUserId];
  if (params.broadcast) {
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { id: true },
    });
    for (const a of admins) {
      if (!targets.includes(a.id)) targets.push(a.id);
    }
  }

  await prisma.notification.createMany({
    data: targets.map((userId) => ({
      userId,
      type: 'AUDIT',
      title: title.slice(0, 200),
      message: message.slice(0, 5000),
    })),
  });
}
