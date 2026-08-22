import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StudentFilters } from '@/components/admin/student-filters';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';

const PAGE_SIZE = 25;

function courseKey(faculty: string, department: string, level: string, semester: string) {
  return `${faculty}|${department}|${level}|${semester}`;
}

export default async function AdminStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);

  const where: Record<string, unknown> = { role: 'STUDENT' };
  if (sp.faculty) where.faculty = sp.faculty;
  if (sp.department) where.department = sp.department;
  if (sp.level) where.level = sp.level;
  if (sp.semester) where.semester = sp.semester;
  if (sp.activity === 'active30') where.lastLoginAt = { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) };
  if (sp.activity === 'never') where.lastLoginAt = null;
  if (sp.q) {
    where.OR = [
      { fullName: { contains: sp.q, mode: 'insensitive' } },
      { email: { contains: sp.q, mode: 'insensitive' } },
      { matricNumber: { contains: sp.q, mode: 'insensitive' } },
    ];
  }

  // Distinct filter options come from the full student population, not the
  // current filtered result — otherwise picking one filter would shrink the
  // choices available in the others.
  const [
    faculties,
    departments,
    levels,
    semesters,
    total,
    students,
    courseFacets,
  ] = await Promise.all([
    prisma.user.findMany({ where: { role: 'STUDENT' }, distinct: ['faculty'], select: { faculty: true }, orderBy: { faculty: 'asc' } }),
    prisma.user.findMany({ where: { role: 'STUDENT' }, distinct: ['department'], select: { department: true }, orderBy: { department: 'asc' } }),
    prisma.user.findMany({ where: { role: 'STUDENT' }, distinct: ['level'], select: { level: true }, orderBy: { level: 'asc' } }),
    prisma.user.findMany({ where: { role: 'STUDENT' }, distinct: ['semester'], select: { semester: true }, orderBy: { semester: 'asc' } }),
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true, fullName: true, email: true, matricNumber: true, university: true,
        faculty: true, department: true, level: true, semester: true,
        subscriptionTier: true, lastLoginAt: true, createdAt: true,
      },
    }),
    // Small catalogue (confirmed elsewhere in this codebase) — fetching every
    // course's facet fields and counting in JS avoids a per-row query for
    // "how many courses match this student's faculty/department/level/semester."
    prisma.course.findMany({ select: { faculty: true, department: true, level: true, semester: true } }),
  ]);

  const courseCounts = new Map<string, number>();
  for (const c of courseFacets) {
    const key = courseKey(c.faculty, c.department, c.level, c.semester);
    courseCounts.set(key, (courseCounts.get(key) || 0) + 1);
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const buildPageHref = (p: number) => {
    const next = new URLSearchParams(
      Object.entries(sp).filter(([, v]) => v !== undefined) as [string, string][]
    );
    next.set('page', String(p));
    return `/admin/students?${next.toString()}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin" className="inline-flex items-center gap-1 text-sm font-medium text-lipro-600/70 hover:underline dark:text-lipro-300/70">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Admin
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Students</h1>
        <p className="text-sm text-lipro-600/70 dark:text-lipro-200/70">
          {total} student{total === 1 ? '' : 's'} match the current filters
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle>Filter</CardTitle><CardDescription>Faculty, department, level, semester, and login activity</CardDescription></CardHeader>
        <CardContent>
          <StudentFilters
            faculties={faculties.map((f) => f.faculty)}
            departments={departments.map((d) => d.department)}
            levels={levels.map((l) => l.level)}
            semesters={semesters.map((s) => s.semester)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-lipro-200/30 text-left text-xs uppercase tracking-wide text-lipro-700/70 dark:text-lipro-200/70">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-2 py-3">Matric</th>
                  <th className="px-2 py-3">Faculty / Dept</th>
                  <th className="px-2 py-3">Level</th>
                  <th className="px-2 py-3">Semester</th>
                  <th className="px-2 py-3">Matching courses</th>
                  <th className="px-2 py-3">Tier</th>
                  <th className="px-2 py-3">Last login</th>
                  <th className="px-4 py-3">Joined</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => {
                  const matches = courseCounts.get(courseKey(s.faculty, s.department, s.level, s.semester)) || 0;
                  return (
                    <tr key={s.id} className="border-b border-lipro-200/10 last:border-0">
                      <td className="px-4 py-3">
                        <div className="font-medium">{s.fullName}</div>
                        <div className="text-xs text-lipro-600/60 dark:text-lipro-200/60">{s.email}</div>
                      </td>
                      <td className="px-2 py-3 text-lipro-600/70 dark:text-lipro-200/70">{s.matricNumber}</td>
                      <td className="px-2 py-3">
                        <div>{s.faculty}</div>
                        <div className="text-xs text-lipro-600/60 dark:text-lipro-200/60">{s.department}</div>
                      </td>
                      <td className="px-2 py-3">L{s.level}</td>
                      <td className="px-2 py-3">{s.semester}</td>
                      <td className="px-2 py-3">
                        <Badge tone={matches > 0 ? 'indigo' : 'rose'}>{matches} course{matches === 1 ? '' : 's'}</Badge>
                      </td>
                      <td className="px-2 py-3">
                        <Badge tone={s.subscriptionTier === 'FREE' ? 'purple' : s.subscriptionTier === 'PREMIUM' ? 'amber' : 'green'}>
                          {s.subscriptionTier}
                        </Badge>
                      </td>
                      <td className="px-2 py-3 text-lipro-600/60 dark:text-lipro-200/60">
                        {s.lastLoginAt ? new Date(s.lastLoginAt).toLocaleDateString() : 'Never'}
                      </td>
                      <td className="px-4 py-3 text-lipro-600/60 dark:text-lipro-200/60">{new Date(s.createdAt).toLocaleDateString()}</td>
                    </tr>
                  );
                })}
                {students.length === 0 && (
                  <tr><td colSpan={9} className="px-4 py-10 text-center text-lipro-600/60 dark:text-lipro-200/60">No students match these filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-lipro-600/60 dark:text-lipro-200/60">Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <Link
              href={buildPageHref(Math.max(1, page - 1))}
              aria-disabled={page <= 1}
              className={`inline-flex items-center gap-1 rounded-xl border border-lipro-200/60 px-3 py-1.5 dark:border-lipro-500/20 ${page <= 1 ? 'pointer-events-none opacity-40' : 'hover:bg-lipro-50 dark:hover:bg-lipro-950/40'}`}
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Previous
            </Link>
            <Link
              href={buildPageHref(Math.min(totalPages, page + 1))}
              aria-disabled={page >= totalPages}
              className={`inline-flex items-center gap-1 rounded-xl border border-lipro-200/60 px-3 py-1.5 dark:border-lipro-500/20 ${page >= totalPages ? 'pointer-events-none opacity-40' : 'hover:bg-lipro-50 dark:hover:bg-lipro-950/40'}`}
            >
              Next <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
