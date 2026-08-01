import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { Role, JWTPayload } from "@/types";

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET || "dev-secret-change-me-in-production-please-yes-yes"
);

export const TOKEN_COOKIE = "lipro_token";

export async function signToken(payload: JWTPayload): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
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
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
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
