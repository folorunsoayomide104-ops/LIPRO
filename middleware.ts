import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { resolveJwtSecret } from "./lib/jwt-secret";

// Fail-closed by design: PUBLIC_PATHS is the allowlist, everything else
// requires auth by default. The previous version inverted this — a growing
// list of *protected* prefixes, public unless explicitly listed — which
// fails open: /flashcards shipped without anyone remembering to add it here,
// and relied entirely on its own page-level getSession() check for auth. A
// page that forgets that check too would have been silently public. This
// version can't repeat that failure mode; a new page is protected by default.
const PUBLIC_PATHS = [
  "/", "/about", "/logo", "/preview", "/privacy", "/terms",
  "/login", "/register", "/forgot-password", "/reset-password",
  "/help-center", "/documentation", "/support", "/cookie-policy",
  "/manifest.webmanifest", // PWA manifest — browsers fetch this unauthenticated
  "/robots.txt", "/sitemap.xml", // crawlers fetch these unauthenticated
];
const PUBLIC_API = ["/api/auth/register", "/api/auth/login", "/api/auth/google", "/api/auth/reset-password", "/api/paystack/webhook"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_API.some((p) => pathname.startsWith(p))) return NextResponse.next();
  if (PUBLIC_PATHS.includes(pathname) || pathname.startsWith("/_next") || pathname.startsWith("/static") || pathname.match(/\.(svg|png|webp|jpg|ico|css|js|html)$/)) {
    return NextResponse.next();
  }
  const token = req.cookies.get("lipro_token")?.value;
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }
  try {
    await jwtVerify(token, resolveJwtSecret());
    return NextResponse.next();
  } catch {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    const res = NextResponse.redirect(url);
    res.cookies.delete("lipro_token");
    return res;
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
