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
export const GOOGLE_SIGNUP_COOKIE = "lipro_google_signup";
export const GOOGLE_SIGNUP_TTL_SECONDS = 60 * 15; // 15 minutes — just long enough to fill in the registration form

export async function signToken(payload: JWTPayload, options?: { remember?: boolean }): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(options?.remember ? "30d" : "7d")
    .sign(resolveJwtSecret());
}

export async function signResetToken(userId: string): Promise<string> {
  return await new SignJWT({ purpose: "password-reset", userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${RESET_TOKEN_TTL_SECONDS}s`)
    .sign(resolveJwtSecret());
}

export interface GooglePendingSignup {
  email: string;
  googleId: string;
  fullName: string;
}

// Bridges a brand-new Google sign-in to the registration form: this app's
// registration requires matric number/university/faculty/department, none
// of which Google can supply, so a first-time Google user can't be created
// immediately. This short-lived, signed token carries the Google-verified
// identity (so the register page never has to trust client input for email
// ownership) until they finish the required fields.
export async function signGooglePendingSignup(payload: GooglePendingSignup): Promise<string> {
  return await new SignJWT({ purpose: "google-signup", ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${GOOGLE_SIGNUP_TTL_SECONDS}s`)
    .sign(resolveJwtSecret());
}

export async function verifyGooglePendingSignup(token: string): Promise<GooglePendingSignup | null> {
  try {
    const { payload } = await jwtVerify(token, resolveJwtSecret());
    if (payload.purpose !== "google-signup") return null;
    if (typeof payload.email !== "string" || typeof payload.googleId !== "string" || typeof payload.fullName !== "string") return null;
    return { email: payload.email, googleId: payload.googleId, fullName: payload.fullName };
  } catch {
    return null;
  }
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

export async function setAuthCookie(token: string, options?: { remember?: boolean }) {
  const store = await cookies();
  store.set(TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    maxAge: 60 * 60 * 24 * (options?.remember ? 30 : 7),
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
