"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, Mail, QrCode, ShieldCheck } from "lucide-react";
import {
  loginAction,
  type LoginActionState,
} from "@/app/login/actions";

const initialState: LoginActionState = { error: "" };

export function LoginForm({
  configured,
  nextPath,
  initialMessage,
  locale,
  wecomConfigured,
}: {
  configured: boolean;
  nextPath: string;
  initialMessage?: string;
  locale: "zh" | "en";
  wecomConfigured: boolean;
}) {
  const isEnglish = locale === "en";
  const [showPassword, setShowPassword] = useState(false);
  const [state, formAction, isPending] = useActionState(
    loginAction,
    initialState,
  );

  return (
    <form action={formAction} className="mt-8 space-y-5">
      <input name="next" type="hidden" value={nextPath} />
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground" htmlFor="email">
          {isEnglish ? "Company email" : "企业邮箱"}
        </label>
        <div className="group relative">
          <Mail className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#7b91a4]" />
          <input
            className="h-12 w-full rounded-xl border border-[#cddce7] bg-white/75 pl-11 pr-4 text-[15px] outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/60 focus:border-[#149eaa]/45 focus:bg-white focus:ring-4 focus:ring-[#149eaa]/8"
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="name@dxmstech.cn"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex min-h-5 items-center justify-between gap-3">
          <label
            className="block shrink-0 text-sm font-medium text-foreground"
            htmlFor="password"
          >
            {isEnglish ? "Password" : "登录密码"}
          </label>
          <span
            className="truncate text-right text-xs font-medium text-[#d83b46]"
            aria-live="polite"
          >
            {state.error}
          </span>
        </div>
        <div className="group relative">
          <input
            className="h-12 w-full rounded-xl border border-[#cddce7] bg-white/75 px-4 pr-12 text-[15px] outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/60 focus:border-[#149eaa]/45 focus:bg-white focus:ring-4 focus:ring-[#149eaa]/8"
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder={isEnglish ? "Enter your password" : "请输入密码"}
            required
          />
          <button
            className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            type="button"
            onClick={() => setShowPassword((current) => !current)}
            aria-label={
              showPassword
                ? isEnglish
                  ? "Hide password"
                  : "隐藏密码"
                : isEnglish
                  ? "Show password"
                  : "显示密码"
            }
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs">
        <label className="flex cursor-pointer items-center gap-2 text-muted-foreground">
          <input
            className="size-3.5 rounded border-[#b8cad8] accent-[#138d9d]"
            defaultChecked
            name="remember"
            type="checkbox"
          />
          {isEnglish ? "Remember me" : "记住我"}
        </label>
        <Link className="font-medium text-[#0c8294] transition hover:text-[#096776]" href="/forgot-password">
          {isEnglish ? "Forgot password?" : "忘记密码？"}
        </Link>
      </div>

      <button
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[linear-gradient(90deg,#0d9a9e,#166fb5)] px-4 text-[15px] font-medium text-white shadow-[0_14px_34px_-16px_rgba(11,108,151,.72)] transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#138d9d]/18 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isPending}
        type="submit"
      >
        {isPending
          ? isEnglish
            ? "Verifying account…"
            : "正在验证账号…"
          : isEnglish
            ? "Sign in to DEXIN NEBULA"
            : "登录德馨星云"}
        <span aria-hidden="true">→</span>
      </button>

      <div className="flex items-center gap-3 py-0.5 text-[11px] text-muted-foreground/60">
        <span className="h-px flex-1 bg-border" />
        <span>{isEnglish ? "or" : "或"}</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      {wecomConfigured ? (
        <Link
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#c9dce6] bg-white/80 px-4 text-[15px] font-medium text-[#183e59] shadow-[0_10px_28px_-22px_rgba(20,66,105,.5)] transition hover:border-[#20a7ae]/45 hover:bg-[#f4fbfb] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#138d9d]/12"
          href={`/auth/wecom?next=${encodeURIComponent(nextPath)}`}
        >
          <QrCode className="size-[18px] text-[#159b83]" />
          {isEnglish ? "Sign in with WeCom QR code" : "企业微信扫码登录"}
        </Link>
      ) : (
        <div
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#cddce7] bg-[#f7f9fb]/80 px-4 text-[14px] font-medium text-muted-foreground"
          title={isEnglish ? "Administrator configuration required" : "需管理员配置企业微信应用参数"}
        >
          <QrCode className="size-[18px]" />
          {isEnglish ? "WeCom QR sign-in · Setup required" : "企业微信扫码登录 · 待配置"}
        </div>
      )}

      <div
        className="flex min-h-5 items-start justify-center gap-2 text-center text-xs leading-5 text-muted-foreground"
        aria-live="polite"
      >
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-[#527995]" />
        <span>
        {initialMessage ||
          (configured
            ? isEnglish
              ? "Encrypted transmission · Protecting your data security"
              : "安全加密传输 · 保护您的数据安全"
            : isEnglish
              ? "Supabase is not configured. Employee accounts are currently unavailable."
              : "当前未配置 Supabase，真实员工账号暂不可用。")}
        </span>
      </div>

      {!configured && (
        <Link
          className="flex h-10 w-full items-center justify-center rounded-xl border border-border bg-card text-sm font-medium text-foreground transition-colors hover:bg-muted"
          href="/dashboard"
        >
          {isEnglish ? "Open local Dashboard preview" : "进入 Dashboard 本机体验版"}
        </Link>
      )}
    </form>
  );
}
