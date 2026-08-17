import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { Role, JWTPayload } from "@/types";
import { resolveJwtSecret } from "./jwt-secret";

// Resolved lazily on first actual use, not at module scope — Next.js
// evaluates route modules during `next build`'s page-data-collection step,
// before request-time env vars are necessarily the ones that matter, so a
// module-scope throw here would fail the build itself rather than fail a
// real request.
export const TOKEN_COOKIE = "lipro_token";
export const RESET_TOKEN_TTL_SECONDS = 60 * 30; // 30 minutes

export async function signToken(payload: JWTPayload): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(resolveJwtSecret());
}

export async function signResetToken(userId: string): Promise<string> {
  return await new SignJWT({ purpose: "password-reset", userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${RESET_TOKEN_TTL_SECONDS}s`)
    .sign(resolveJwtSecret());
}

export async function verifyResetToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, resolveJwtSecret());
    if (payload.purpose !== "password-reset") return null;
    return typeof payload.userId === "string" ? payload.userId : null;
  } catch {
    return null;
  }
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, resolveJwtSecret());
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<JWTPayload | null> {
  const store = await cookies();
  const token = store.get(TOKEN_COOKIE)?.value;
  if (!token) return null;
  return await verifyToken(token);
}

export async function setAuthCookie(token: string) {
  const store = await cookies();
  store.set(TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
}

export async function clearAuthCookie() {
  const store = await cookies();
  store.delete(TOKEN_COOKIE);
}

export function roleRank(role: Role): number {
  return { STUDENT: 0, LECTURER: 1, ADMIN: 2, SUPER_ADMIN: 3 }[role];
}

export function canAccess(required: Role, current: Role): boolean {
  return roleRank(current) >= roleRank(required);
}
