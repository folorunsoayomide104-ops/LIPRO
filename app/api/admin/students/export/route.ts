import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/api-guard';
import { logAdminAudit } from '@/lib/admin/audit';

export async function GET() {
  const { ok, user, response } = await guard('ADMIN');
  if (!ok || !user) return response!;

  const students = await prisma.user.findMany({
    where: { role: 'STUDENT' },
    orderBy: { createdAt: 'desc' },
    select: {
      fullName: true,
      email: true,
      matricNumber: true,
      university: true,
      faculty: true,
      department: true,
      level: true,
      semester: true,
      subscriptionTier: true,
      walletBalance: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });

  const header = [
    'fullName',
    'email',
    'matricNumber',
    'university',
    'faculty',
    'department',
    'level',
    'semester',
    'subscriptionTier',
    'walletBalance',
    'lastLoginAt',
    'createdAt',
  ];

  const escape = (v: unknown) => {
    const s = v == null ? '' : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const lines = [
    header.join(','),
    ...students.map((s) =>
      [
        s.fullName,
        s.email,
        s.matricNumber,
        s.university,
        s.faculty,
        s.department,
        s.level,
        s.semester,
        s.subscriptionTier,
        s.walletBalance,
        s.lastLoginAt?.toISOString() ?? '',
        s.createdAt.toISOString(),
      ]
        .map(escape)
        .join(','),
    ),
  ];

  await logAdminAudit({
    actorUserId: user.userId,
    actorEmail: user.email,
    action: 'export_students',
    detail: `Exported ${students.length} student rows as CSV`,
    broadcast: true,
  });

  const csv = lines.join('\n');
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="lipro-students-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
