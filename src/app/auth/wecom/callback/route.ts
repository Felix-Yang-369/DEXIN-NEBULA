import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getWeComMemberFromCode } from "@/lib/wecom/client";
import { isWeComConfigured } from "@/lib/wecom/config";
import {
  normalizedWeComEmails,
  safeWeComReturnPath,
  weComStateMatches,
} from "@/lib/wecom/oauth";

const STATE_COOKIE = "dexin-wecom-state";
const NEXT_COOKIE = "dexin-wecom-next";

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
  const nextPath = safeWeComReturnPath(cookieStore.get(NEXT_COOKIE)?.value);
  cookieStore.delete(STATE_COOKIE);
  cookieStore.delete(NEXT_COOKIE);

  if (!weComStateMatches(state, expectedState)) {
    return loginError(request, "wecom_invalid_state");
  }
  if (!code) {
    return loginError(request, "wecom_denied");
  }

  try {
    const member = await getWeComMemberFromCode(code);
    const memberEmails = normalizedWeComEmails([
      member.biz_mail,
      member.email,
    ]);
    if (memberEmails.length === 0) {
      return loginError(request, "wecom_account_unavailable");
    }

    const admin = createAdminClient();
    const { data: resolvedRows, error: resolveError } = await admin.rpc(
      "resolve_wecom_login",
      {
        p_wecom_user_id: member.userid,
        p_member_emails: memberEmails,
        p_member_name: member.name ?? null,
      },
    );
    if (resolveError?.code === "23505") {
      return loginError(request, "wecom_identity_conflict");
    }
    if (resolveError?.code === "P0002") {
      return loginError(request, "wecom_account_unavailable");
    }
    if (resolveError) throw resolveError;

    const resolved = resolvedRows?.[0];
    if (!resolved?.resolved_auth_user_id || !resolved.resolved_identity_id) {
      return loginError(request, "wecom_account_unavailable");
    }

    const { data: authUserData, error: authUserError } =
      await admin.auth.admin.getUserById(resolved.resolved_auth_user_id);
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
      sessionData.user.id !== resolved.resolved_auth_user_id
    ) {
      await supabase.auth.signOut();
      throw sessionError ?? new Error("登录账号校验失败");
    }

    const { error: auditError } = await admin.rpc("record_wecom_login", {
      p_identity_id: resolved.resolved_identity_id,
    });
    if (auditError) {
      await supabase.auth.signOut();
      throw auditError;
    }

    return NextResponse.redirect(new URL(nextPath, request.url));
  } catch (error) {
    console.error("WeCom QR sign-in failed", error);
    return loginError(request, "wecom_failed");
  }
}
