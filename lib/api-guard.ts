import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { verifyToken, roleRank } from "@/lib/auth";
import type { Role, JWTPayload } from "@/types";

export interface GuardResult {
  ok: boolean;
  user?: JWTPayload;
  response?: NextResponse;
}

export async function guard(requiredRole?: Role): Promise<GuardResult> {
  const store = await cookies();
  // The web app authenticates via the httpOnly `lipro_token` cookie set on
  // login. Native mobile clients (the Flutter app) can't rely on that the
  // same way a browser does, so they instead send the token returned in the
  // login/register JSON body as a Bearer header — checked here as a
  // fallback so every existing route using guard() picks up mobile auth for
  // free, no per-route changes needed.
  const authHeader = (await headers()).get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  const token = store.get("lipro_token")?.value || bearerToken;
  if (!token) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  const user = await verifyToken(token);
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Invalid token" }, { status: 401 }),
    };
  }
  if (requiredRole) {
    if (roleRank(user.role) < roleRank(requiredRole)) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      };
    }
  }
  return { ok: true, user };
}
