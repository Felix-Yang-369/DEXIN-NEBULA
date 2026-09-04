import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ChevronDown,
  Languages,
} from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";
import { NebulaLogo } from "@/components/brand/nebula-logo";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { isWeComConfigured } from "@/lib/wecom/config";

export const metadata: Metadata = {
  title: "登录",
  description: "登录德馨星云企业数字化运营平台",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; lang?: string }>;
}) {
  const params = await searchParams;
  const locale = params.lang === "en" ? "en" : "zh";
  const isEnglish = locale === "en";
  const configured = isSupabaseConfigured();
  const wecomConfigured = isWeComConfigured();
  const nextPath =
    params.next?.startsWith("/") && !params.next.startsWith("//")
      ? params.next
      : "/dashboard";
  const initialMessage =
    {
      account_unavailable: isEnglish
        ? "This account is not linked to an active employee profile. Please contact the administrator."
        : "账号未绑定在职员工档案，或已被停用，请联系管理员。",
      wecom_not_configured: isEnglish
        ? "WeCom sign-in has not been configured by the administrator."
        : "企业微信登录尚未完成管理员配置。",
      wecom_invalid_state: isEnglish
        ? "The QR sign-in request expired. Please scan again."
        : "扫码登录请求已失效，请重新扫码。",
      wecom_denied: isEnglish
        ? "WeCom authorization was cancelled or denied."
        : "企业微信授权已取消或未通过。",
      wecom_account_unavailable: isEnglish
        ? "This WeCom member is not linked to an active employee account."
        : "该企业微信成员未匹配到在职员工账号，请联系管理员。",
      wecom_identity_conflict: isEnglish
        ? "This WeCom identity is already linked to another employee account."
        : "该企业微信身份已绑定其他员工账号，请联系管理员处理。",
      wecom_failed: isEnglish
        ? "WeCom sign-in failed. Please try again or use your password."
        : "企业微信登录失败，请重试或使用密码登录。",
      password_changed: isEnglish
        ? "Your password has been updated. Sign in again with the new password."
        : "密码已更新，请使用新密码重新登录。",
    }[params.error ?? ""];
  const languageHref = (language: "zh" | "en") => {
    const query = new URLSearchParams({ lang: language });
    if (params.next) query.set("next", params.next);
    return `/login?${query.toString()}`;
  };

  return (
    <main
      className="min-h-svh bg-background lg:grid lg:grid-cols-[minmax(0,1.04fr)_minmax(520px,0.96fr)]"
      data-ui-system="v3"
    >
      <section className="nebula-panel relative hidden min-h-svh overflow-hidden px-[clamp(40px,4vw,64px)] py-[clamp(38px,3.6vw,56px)] text-white lg:flex lg:flex-col">
        <Image
          alt="德馨星云连接组织协同、业务运营、供应链与数据安全的数字化平台"
          className="pointer-events-none absolute inset-0 size-full origin-bottom scale-[1.055] object-cover object-center"
          fill
          priority
          sizes="(min-width: 1024px) 56vw, 0px"
          src="/login-background.png"
          unoptimized
        />
        <div className="pointer-events-none absolute inset-0 bg-sidebar/72" />

        <div className="relative z-10 h-[53px]">
          <NebulaLogo className="origin-top-left scale-[1.2]" inverse />
        </div>

        <div className="relative z-10 mt-[clamp(48px,5.5vh,76px)] w-full max-w-[720px]">
          <h1 className="max-w-[680px] text-balance text-[clamp(40px,4vw,62px)] font-semibold leading-[1.06] tracking-[-0.045em]">
            {isEnglish ? (
              <>
                DEXIN MIAOSHENG SELF-DEVELOPED
                <br />
                <span className="text-sidebar-primary">AI-NATIVE</span>{" "}
                MANAGEMENT SYSTEM
              </>
            ) : (
              <>
                德馨淼盛自研
                <br />
                <span className="text-sidebar-primary">AI原生</span>
                管理系统
              </>
            )}
          </h1>
          <p className="mt-6 max-w-xl text-[clamp(18px,1.42vw,23px)] leading-8 tracking-[-0.015em] text-white/90">
            {isEnglish
              ? "Connect organization and business within one intelligent nebula."
              : "让组织与业务，在同一片星云中连接。"}
          </p>

        </div>

      </section>

      <section className="relative flex min-h-svh items-center justify-center overflow-hidden bg-card px-5 py-10 sm:px-10 lg:px-12 xl:px-16">
        <div className="pointer-events-none absolute -right-[240px] -top-[250px] size-[700px] rounded-full border border-border" />
        <div className="pointer-events-none absolute -right-[200px] -top-[210px] size-[620px] rounded-full border border-border" />
        <div className="pointer-events-none absolute -right-[160px] -top-[170px] size-[540px] rounded-full border border-border" />
        <div className="absolute left-5 top-6 sm:left-10 lg:hidden">
          <NebulaLogo />
        </div>

        <div className="relative z-10 w-full max-w-[570px] rounded-md border border-white/90 bg-white/90 px-6 py-9  backdrop-blur-xl sm:px-10 sm:py-11 lg:px-12 xl:px-14 xl:py-14">
          <details className="group/language absolute right-7 top-6 text-xs sm:right-9 sm:top-8">
            <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md px-2.5 py-2 font-medium text-foreground transition hover:bg-muted [&::-webkit-details-marker]:hidden">
              <Languages className="size-4" />
              {isEnglish ? "English" : "简体中文"}
              <ChevronDown className="size-3.5 transition group-open/language:rotate-180" />
            </summary>
            <div className="absolute right-0 top-full z-20 mt-1.5 min-w-28 overflow-hidden rounded-md border border-border bg-white p-1 ">
              <Link className={`block rounded-lg px-3 py-2 ${locale === "zh" ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted"}`} href={languageHref("zh")}>
                简体中文
              </Link>
              <Link className={`block rounded-lg px-3 py-2 ${locale === "en" ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted"}`} href={languageHref("en")}>
                English
              </Link>
            </div>
          </details>
          <div className="mb-9 lg:hidden">
            <div className="rounded-lg border border-primary/10 bg-primary/[0.035] px-4 py-3 text-sm leading-6 text-muted-foreground">
              {isEnglish
                ? "Enterprise Digital Operating Platform · Internal preview"
                : "企业数字化运营平台 · 当前为内部开发版本"}
            </div>
          </div>

          <div className="pr-36 text-sm font-semibold text-foreground">
            {isEnglish ? "Welcome back" : "欢迎回来"}
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-foreground sm:text-[36px]">
            {isEnglish ? "Sign in to DEXIN NEBULA" : "登录德馨星云"}
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {isEnglish
              ? "Use your internal company account to enter the workspace."
              : "使用德馨淼盛内部账号进入企业工作台。"}
          </p>

          <LoginForm
            configured={configured}
            initialMessage={initialMessage}
            locale={locale}
            nextPath={nextPath}
            wecomConfigured={wecomConfigured}
          />

        </div>

        <div className="absolute bottom-5 right-6 text-right text-xs leading-5 text-muted-foreground/65 sm:right-10 lg:right-12 xl:right-16">
          <div>{isEnglish ? "Copyright © 2026 DEXIN NEBULA" : "Copyright © 2026 德馨星云 版权所有"}</div>
          <div className="flex items-center justify-end gap-2">
            <Link
              aria-label={isEnglish ? "View ICP filing information" : "查看ICP备案信息"}
              className="transition hover:text-primary"
              href="https://beian.miit.gov.cn/"
              rel="noreferrer"
              target="_blank"
            >
              湘ICP备2026033795号-1
            </Link>
            <span className="h-3 w-px bg-border" />
            <Link
              aria-label={isEnglish ? "HARVESTFLOW website (coming soon)" : "HARVESTFLOW 官网入口（待开放）"}
              className="font-medium text-foreground transition hover:text-primary"
              href="#"
            >
              HARVESTFLOW
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
