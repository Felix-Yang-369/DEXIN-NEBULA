import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { buildWeComQrLoginUrl } from "@/lib/wecom/client";
import { isWeComConfigured } from "@/lib/wecom/config";
import { safeWeComReturnPath } from "@/lib/wecom/oauth";

const STATE_COOKIE = "dexin-wecom-state";
const NEXT_COOKIE = "dexin-wecom-next";

export async function GET(request: NextRequest) {
  if (!isWeComConfigured()) {
    return NextResponse.redirect(
      new URL("/login?error=wecom_not_configured", request.url),
    );
  }

  const state = randomBytes(32).toString("base64url");
  const response = NextResponse.redirect(buildWeComQrLoginUrl(state));
  const cookieOptions = {
    httpOnly: true,
    maxAge: 10 * 60,
    path: "/auth/wecom",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
  response.cookies.set(STATE_COOKIE, state, cookieOptions);
  response.cookies.set(
    NEXT_COOKIE,
    safeWeComReturnPath(request.nextUrl.searchParams.get("next")),
    cookieOptions,
  );
  return response;
}
