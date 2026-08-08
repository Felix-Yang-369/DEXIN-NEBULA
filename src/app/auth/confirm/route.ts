import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import {
  PASSWORD_RECOVERY_COOKIE,
  safePasswordReturnPath,
} from "@/lib/auth/password";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
  const nextPath = safePasswordReturnPath(
    request.nextUrl.searchParams.get("next"),
  );
  const supabase = await createClient();

  let error: Error | null = null;
  if (code) {
    ({ error } = await supabase.auth.exchangeCodeForSession(code));
  } else if (tokenHash && type === "recovery") {
    ({ error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    }));
  } else {
    error = new Error("Password recovery parameters are missing.");
  }

  if (error) {
    console.error("Password recovery confirmation failed", error);
    return NextResponse.redirect(
      new URL("/forgot-password?error=invalid_link", request.url),
    );
  }

  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    return NextResponse.redirect(
      new URL("/forgot-password?error=invalid_link", request.url),
    );
  }

  const response = NextResponse.redirect(new URL(nextPath, request.url));
  response.cookies.set(PASSWORD_RECOVERY_COOKIE, data.user.id, {
    httpOnly: true,
    maxAge: 15 * 60,
    path: "/",
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}
