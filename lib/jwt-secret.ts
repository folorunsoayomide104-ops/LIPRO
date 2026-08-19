// No other imports — this must stay safe to import from both the Node
// runtime (lib/auth.ts) and the Edge runtime (middleware.ts).
//
// JWT_SECRET missing in production used to silently fall back to a
// hardcoded string committed in this file's git history. Anyone who reads
// the repo could then forge a token (e.g. role: "ADMIN") signed with
// that known secret and get full admin access — a fail-open bug. This fails
// loudly instead: every request 500s until the env var is set, rather than
// silently accepting forged tokens.
const FALLBACK_DEV_SECRET = "dev-secret-change-me-in-production-please-yes-yes";

export function resolveJwtSecretString(): string {
  const fromEnv = process.env.JWT_SECRET?.trim();
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "JWT_SECRET is not set. Refusing to fall back to a hardcoded secret in production — set JWT_SECRET in your environment."
    );
  }
  return FALLBACK_DEV_SECRET;
}

export function resolveJwtSecret(): Uint8Array {
  return new TextEncoder().encode(resolveJwtSecretString());
}
