import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Mail, ShieldCheck } from "lucide-react";
import { NebulaLogo } from "@/components/brand/nebula-logo";
import { requestPasswordResetAction } from "./actions";

export const metadata: Metadata = {
  title: "找回密码",
  description: "通过企业邮箱重置德馨星云登录密码",
};

const errorMessages: Record<string, string> = {
  invalid_email: "请输入正确的企业邮箱。",
  invalid_link: "重置链接无效或已过期，请重新申请。",
  unavailable: "密码找回服务暂时不可用，请联系管理员。",
};

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const params = await searchParams;
  const error = errorMessages[params.error ?? ""];

  return (
    <main className="flex min-h-svh items-center justify-center bg-[radial-gradient(circle_at_75%_15%,rgba(180,224,250,.26),transparent_34%),linear-gradient(145deg,#f8fafc,#eef5fa)] px-5 py-10">
      <section className="w-full max-w-[520px] rounded-[28px] border border-white/90 bg-white/95 p-7 shadow-[0_28px_80px_-35px_rgba(20,66,105,.28)] sm:p-10">
        <NebulaLogo />
        <div className="mt-9 flex size-11 items-center justify-center rounded-2xl bg-[#e9f6f7] text-[#0c8792]">
          <Mail className="size-5" />
        </div>
        <h1 className="mt-5 text-3xl font-semibold tracking-[-0.04em] text-[#102f49]">
          找回登录密码
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          输入已绑定的企业邮箱。如果账号存在，系统会发送一封密码重置邮件。
        </p>

        {params.sent ? (
          <div className="mt-7 rounded-2xl border border-[#cfe8dc] bg-[#eef8f2] px-4 py-4 text-sm leading-6 text-[#176b50]">
            如果该邮箱已绑定账号，重置邮件已发送。请检查收件箱和垃圾邮件。
          </div>
        ) : (
          <form action={requestPasswordResetAction} className="mt-7 space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="email">
                企业邮箱
              </label>
              <input
                autoComplete="email"
                className="h-12 w-full rounded-xl border border-[#cddce7] bg-white px-4 text-[15px] outline-none transition focus:border-[#149eaa]/45 focus:ring-4 focus:ring-[#149eaa]/8"
                id="email"
                name="email"
                placeholder="name@dxmstech.cn"
                required
                type="email"
              />
            </div>
            {error && (
              <p aria-live="polite" className="text-sm text-[#b13f49]">
                {error}
              </p>
            )}
            <button className="flex h-12 w-full items-center justify-center rounded-xl bg-[linear-gradient(90deg,#0d9a9e,#166fb5)] px-4 text-[15px] font-medium text-white" type="submit">
              发送重置邮件
            </button>
          </form>
        )}

        <div className="mt-6 flex items-center gap-2 rounded-2xl bg-[#f3f7fa] px-4 py-3 text-xs leading-5 text-muted-foreground">
          <ShieldCheck className="size-4 shrink-0 text-[#527995]" />
          为保护账号隐私，系统不会显示该邮箱是否已注册。
        </div>
        <Link className="mt-6 flex items-center justify-center gap-2 text-sm font-medium text-[#0c8294]" href="/login">
          <ArrowLeft className="size-4" />
          返回登录
        </Link>
      </section>
    </main>
  );
}
