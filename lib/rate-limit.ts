import { NextResponse } from 'next/server';
import { prisma } from './prisma';

export interface RateLimitResult {
  ok: boolean;
  retryAfterSec: number;
}

/**
 * Fixed-window rate limiter backed by Postgres (see RateLimitHit in
 * schema.prisma for why: no shared memory across Vercel serverless
 * instances). Call once per attempt with a key scoped to what you're
 * protecting (e.g. `login:ip:<ip>` or `login:email:<email>`) — every call
 * that isn't rejected records a hit, so the window naturally slides forward
 * as old hits age out of it.
 */
export async function checkRateLimit(key: string, windowMs: number, max: number): Promise<RateLimitResult> {
  const windowStart = new Date(Date.now() - windowMs);
  const count = await prisma.rateLimitHit.count({ where: { key, createdAt: { gte: windowStart } } });
  if (count >= max) {
    return { ok: false, retryAfterSec: Math.ceil(windowMs / 1000) };
  }
  await prisma.rateLimitHit.create({ data: { key } });

  // Best-effort cleanup so the table doesn't grow unbounded under a
  // sustained attack — cheap enough to skip most of the time and not worth
  // blocking the response on, so it isn't awaited.
  if (Math.random() < 0.02) {
    prisma.rateLimitHit.deleteMany({ where: { createdAt: { lt: windowStart } } }).catch(() => {});
  }

  return { ok: true, retryAfterSec: 0 };
}

/** Best-effort client IP from the headers Vercel sets on inbound requests. */
export function getClientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  const real = req.headers.get('x-real-ip');
  if (real) return real.trim();
  return 'unknown';
}

export function rateLimitResponse(result: RateLimitResult) {
  return NextResponse.json(
    { error: 'Too many attempts. Please try again later.' },
    { status: 429, headers: { 'Retry-After': String(result.retryAfterSec) } }
  );
}
