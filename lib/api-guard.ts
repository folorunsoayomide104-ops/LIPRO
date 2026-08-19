import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken, roleRank } from "@/lib/auth";
import type { Role, JWTPayload } from "@/types";

export interface GuardResult {
  ok: boolean;
  user?: JWTPayload;
  response?: NextResponse;
}

export async function guard(requiredRole?: Role): Promise<GuardResult> {
  const store = await cookies();
  const token = store.get("lipro_token")?.value;
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
