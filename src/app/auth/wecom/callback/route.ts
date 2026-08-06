import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getWeComMemberFromCode } from "@/lib/wecom/client";
import { isWeComConfigured } from "@/lib/wecom/config";

const STATE_COOKIE = "dexin-wecom-state";
const NEXT_COOKIE = "dexin-wecom-next";

function safeNext(value: string | undefined) {
  return value?.startsWith("/") && !value.startsWith("//")
    ? value
    : "/dashboard";
}

function stateMatches(actual: string | null, expected: string | undefined) {
  if (!actual || !expected) return false;
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

function loginError(request: NextRequest, code: string) {
  return NextResponse.redirect(new URL(`/login?error=${code}`, request.url));
}

export async function GET(request: NextRequest) {
  if (!isWeComConfigured()) {
    return loginError(request, "wecom_not_configured");
  }

  const cookieStore = await cookies();
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expectedState = cookieStore.get(STATE_COOKIE)?.value;
  const nextPath = safeNext(cookieStore.get(NEXT_COOKIE)?.value);
  cookieStore.delete(STATE_COOKIE);
  cookieStore.delete(NEXT_COOKIE);

  if (!stateMatches(state, expectedState)) {
    return loginError(request, "wecom_invalid_state");
  }
  if (!code) {
    return loginError(request, "wecom_denied");
  }

  try {
    const member = await getWeComMemberFromCode(code);
    const memberEmails = [member.biz_mail, member.email]
      .filter((email): email is string => Boolean(email?.trim()))
      .map((email) => email.trim().toLowerCase());
    if (memberEmails.length === 0) {
      return loginError(request, "wecom_account_unavailable");
    }

    const admin = createAdminClient();
    const matchedEmployees = [];
    for (const email of [...new Set(memberEmails)]) {
      const { data, error } = await admin
        .from("employees")
        .select("id, auth_user_id, email, status")
        .ilike("email", email)
        .limit(2);
      if (error) throw error;
      matchedEmployees.push(...(data ?? []));
    }

    const uniqueEmployees = [
      ...new Map(matchedEmployees.map((employee) => [employee.id, employee])).values(),
    ];
    const employee = uniqueEmployees.length === 1 ? uniqueEmployees[0] : null;
    if (!employee || employee.status !== "active" || !employee.auth_user_id) {
      return loginError(request, "wecom_account_unavailable");
    }

    const { data: authUserData, error: authUserError } =
      await admin.auth.admin.getUserById(employee.auth_user_id);
    const authEmail = authUserData.user?.email?.trim().toLowerCase();
    if (authUserError || !authEmail) {
      return loginError(request, "wecom_account_unavailable");
    }

    const { data: linkData, error: linkError } =
      await admin.auth.admin.generateLink({
        type: "magiclink",
        email: authEmail,
      });
    const tokenHash = linkData.properties?.hashed_token;
    if (linkError || !tokenHash) throw linkError ?? new Error("登录凭证生成失败");

    const supabase = await createClient();
    const { data: sessionData, error: sessionError } =
      await supabase.auth.verifyOtp({
        type: "magiclink",
        token_hash: tokenHash,
      });
    if (
      sessionError ||
      !sessionData.user ||
      sessionData.user.id !== employee.auth_user_id
    ) {
      await supabase.auth.signOut();
      throw sessionError ?? new Error("登录账号校验失败");
    }

    return NextResponse.redirect(new URL(nextPath, request.url));
  } catch (error) {
    console.error("WeCom QR sign-in failed", error);
    return loginError(request, "wecom_failed");
  }
}
