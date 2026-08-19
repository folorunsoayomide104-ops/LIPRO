import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/api-guard';
import { canAccess } from '@/lib/auth';
import { questionSchema } from '@/lib/validators';

const PAGE_SIZE = 200;

/**
 * List questions. Answers/explanations are stripped by default — this used to
 * return the full row (including `answer`) to any authenticated user, which let
 * a student read the key before sitting the exam. `includeAnswers=1` is only
 * honored for an admin, or for the student who owns the source material
 * (course-scoped questions can only ever be authored by an admin, so there's
 * no separate "course owner" case to check there).
 */
export async function GET(req: Request) {
  const { ok, user, response } = await guard();
  if (!ok || !user) return response!;

  const url = new URL(req.url);
  const courseId = url.searchParams.get('courseId');
  const sourceId = url.searchParams.get('sourceId');
  const type = url.searchParams.get('type');
  const cursor = url.searchParams.get('cursor');
  const wantAnswers = url.searchParams.get('includeAnswers') === '1';

  if (!courseId && !sourceId) {
    return NextResponse.json({ error: 'courseId or sourceId is required' }, { status: 422 });
  }

  let canSeeAnswers = canAccess('ADMIN', user.role);
  if (wantAnswers && !canSeeAnswers && sourceId) {
    const material = await prisma.material.findUnique({ where: { id: sourceId }, select: { userId: true } });
    canSeeAnswers = material?.userId === user.userId;
  }

  const where: Record<string, unknown> = {
    ...(courseId ? { courseId } : {}),
    ...(sourceId ? { sourceId } : {}),
    ...(type ? { type } : {}),
  };

  // Always fetch the full row and strip in JS for the unprivileged case —
  // Prisma's `select` type can't cleanly branch on a runtime condition.
  const rows = await prisma.question.findMany({
    where,
    include: { course: { select: { code: true, title: true } } },
    orderBy: { createdAt: 'desc' },
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > PAGE_SIZE;
  const page = hasMore ? rows.slice(0, PAGE_SIZE) : rows;

  const canSeeAll = wantAnswers && canSeeAnswers;
  const questions = canSeeAll
    ? page
    : page.map(({ answer, explanation, ...rest }) => rest);

  return NextResponse.json({
    questions,
    nextCursor: hasMore ? page[page.length - 1].id : null,
  });
}

/**
 * Create a question. Course-scoped questions still require ADMIN (as
 * before); material-scoped questions are now allowed for any user who owns
 * that material — this was previously impossible because `courseId` was a
 * required field on the schema.
 */
export async function POST(req: Request) {
  const { ok, user, response } = await guard();
  if (!ok || !user) return response!;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  const parsed = questionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 422 });

  const { courseId, sourceId } = parsed.data;

  if (sourceId) {
    const material = await prisma.material.findFirst({ where: { id: sourceId, userId: user.userId } });
    if (!material) return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  } else if (courseId) {
    if (!canAccess('ADMIN', user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const q = await prisma.question.create({
    data: {
      courseId: courseId ?? null,
      sourceId: sourceId ?? null,
      type: parsed.data.type,
      question: parsed.data.question,
      options: parsed.data.options ?? null,
      answer: parsed.data.answer,
      explanation: parsed.data.explanation ?? null,
      imageUrl: parsed.data.imageUrl ?? null,
      points: parsed.data.points,
      authorId: user.userId,
    },
  });
  return NextResponse.json({ question: q }, { status: 201 });
}
