import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { KeyRound, ShieldCheck } from "lucide-react";
import { NebulaLogo } from "@/components/brand/nebula-logo";
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_RECOVERY_COOKIE,
} from "@/lib/auth/password";
import { createClient } from "@/lib/supabase/server";
import { resetRecoveredPasswordAction } from "./actions";

export const metadata: Metadata = {
  title: "设置新密码",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const [{ data }, cookieStore] = await Promise.all([
    supabase.auth.getUser(),
    cookies(),
  ]);
  if (
    !data.user ||
    cookieStore.get(PASSWORD_RECOVERY_COOKIE)?.value !== data.user.id
  ) {
    redirect("/forgot-password?error=invalid_link");
  }

  const error =
    params.error === "update_failed"
      ? "密码更新失败，请重新申请重置邮件。"
      : params.error;

  return (
    <main className="flex min-h-svh items-center justify-center bg-[radial-gradient(circle_at_75%_15%,rgba(180,224,250,.26),transparent_34%),linear-gradient(145deg,#f8fafc,#eef5fa)] px-5 py-10">
      <section className="w-full max-w-[520px] rounded-[28px] border border-white/90 bg-white/95 p-7 shadow-[0_28px_80px_-35px_rgba(20,66,105,.28)] sm:p-10">
        <NebulaLogo />
        <div className="mt-9 flex size-11 items-center justify-center rounded-2xl bg-[#e9f6f7] text-[#0c8792]">
          <KeyRound className="size-5" />
        </div>
        <h1 className="mt-5 text-3xl font-semibold tracking-[-0.04em] text-[#102f49]">
          设置新密码
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          正在为 <span className="font-medium text-foreground">{data.user.email}</span> 重置密码。
        </p>

        <form action={resetRecoveredPasswordAction} className="mt-7 space-y-5">
          <PasswordFields />
          {error && (
            <p aria-live="polite" className="text-sm text-[#b13f49]">
              {error}
            </p>
          )}
          <button className="flex h-12 w-full items-center justify-center rounded-xl bg-[linear-gradient(90deg,#0d9a9e,#166fb5)] px-4 text-[15px] font-medium text-white" type="submit">
            更新密码并重新登录
          </button>
        </form>
        <div className="mt-6 flex items-center gap-2 rounded-2xl bg-[#f3f7fa] px-4 py-3 text-xs leading-5 text-muted-foreground">
          <ShieldCheck className="size-4 shrink-0 text-[#527995]" />
          修改成功后会注销当前账号的已有会话。
        </div>
        <Link className="mt-6 block text-center text-sm font-medium text-[#0c8294]" href="/login">
          取消并返回登录
        </Link>
      </section>
    </main>
  );
}

function PasswordFields() {
  const inputClassName =
    "h-12 w-full rounded-xl border border-[#cddce7] bg-white px-4 text-[15px] outline-none transition focus:border-[#149eaa]/45 focus:ring-4 focus:ring-[#149eaa]/8";
  return (
    <>
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="password">新密码</label>
        <input autoComplete="new-password" className={inputClassName} id="password" minLength={PASSWORD_MIN_LENGTH} name="password" required type="password" />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="passwordConfirmation">确认新密码</label>
        <input autoComplete="new-password" className={inputClassName} id="passwordConfirmation" minLength={PASSWORD_MIN_LENGTH} name="passwordConfirmation" required type="password" />
      </div>
      <p className="text-xs leading-5 text-muted-foreground">
        至少 {PASSWORD_MIN_LENGTH} 位，并包含大写字母、小写字母、数字、符号中的至少三类。
      </p>
    </>
  );
}
