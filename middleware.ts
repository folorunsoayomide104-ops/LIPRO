import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const PUBLIC_PATHS = ["/", "/login", "/register", "/privacy", "/terms", "/about"];
const PUBLIC_API = ["/api/auth/register", "/api/auth/login", "/api/auth/forgot-password", "/api/auth/reset-password", "/api/paystack/webhook"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_API.some((p) => pathname.startsWith(p))) return NextResponse.next();
  if (PUBLIC_PATHS.includes(pathname) || pathname.startsWith("/_next") || pathname.startsWith("/static") || pathname.match(/\.(svg|png|jpg|ico|css|js)$/)) {
    return NextResponse.next();
  }
  if (!pathname.startsWith("/api") && !pathname.startsWith("/student") && !pathname.startsWith("/lecturer") && !pathname.startsWith("/admin") && !pathname.startsWith("/super-admin") && !pathname.startsWith("/courses") && !pathname.startsWith("/notes") && !pathname.startsWith("/cbt") && !pathname.startsWith("/lipro-ai") && !pathname.startsWith("/wallet") && !pathname.startsWith("/subscription") && !pathname.startsWith("/settings") && !pathname.startsWith("/dashboard")) {
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
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret-change-me-in-production-please-yes-yes");
    await jwtVerify(token, secret);
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
