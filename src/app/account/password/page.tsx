import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound, ShieldCheck } from "lucide-react";
import { WorkflowShell } from "@/features/approvals/workflow-shell";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/password";
import { changeOwnPasswordAction } from "./actions";

export const metadata: Metadata = { title: "修改密码" };
export const dynamic = "force-dynamic";

const errorMessages: Record<string, string> = {
  current_password_invalid: "当前密码不正确。",
  update_failed: "密码更新失败，请稍后重试或使用邮件找回。",
};

export default async function AccountPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const currentEmployee = await requireCurrentEmployee();
  const params = await searchParams;
  const error = errorMessages[params.error ?? ""] ?? params.error;
  const inputClassName =
    "h-11 w-full rounded-md border border-border bg-white px-3 text-sm outline-none transition focus:border-primary/45 focus:ring-4 focus:ring-primary/8";

  return (
    <WorkflowShell
      activeItem=""
      breadcrumb="个人中心 / 账号信息 / 修改密码"
      currentUser={{
        name: currentEmployee.name,
        roleLabel: currentEmployee.title ?? "内部员工",
      }}
    >
      <main className="mx-auto max-w-[760px] p-4 sm:p-6 xl:p-8">
        <section className="rounded-md border border-border/75 bg-white p-6  sm:p-8">
          <div className="flex size-11 items-center justify-center rounded-lg bg-muted text-primary">
            <KeyRound className="size-5" />
          </div>
          <h1 className="mt-5 text-2xl font-semibold tracking-[-0.035em]">修改登录密码</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            请先验证当前密码。修改成功后，所有已有会话都会被注销。
          </p>

          <form action={changeOwnPasswordAction} className="mt-7 space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="currentPassword">当前密码</label>
              <input autoComplete="current-password" className={inputClassName} id="currentPassword" name="currentPassword" required type="password" />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="password">新密码</label>
                <input autoComplete="new-password" className={inputClassName} id="password" minLength={PASSWORD_MIN_LENGTH} name="password" required type="password" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="passwordConfirmation">确认新密码</label>
                <input autoComplete="new-password" className={inputClassName} id="passwordConfirmation" minLength={PASSWORD_MIN_LENGTH} name="passwordConfirmation" required type="password" />
              </div>
            </div>
            <p className="text-xs leading-5 text-muted-foreground">
              新密码至少 {PASSWORD_MIN_LENGTH} 位，并包含大写字母、小写字母、数字、符号中的至少三类。
            </p>
            {error && (
              <p aria-live="polite" className="rounded-md border border-border bg-muted px-4 py-3 text-sm text-foreground">
                {error}
              </p>
            )}
            <div className="flex flex-col gap-3 sm:flex-row">
              <button className="flex h-11 flex-1 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground" type="submit">
                确认修改密码
              </button>
              <Link className="flex h-11 items-center justify-center rounded-md border border-border px-5 text-sm font-medium text-muted-foreground" href="/account">
                取消
              </Link>
            </div>
          </form>

          <div className="mt-6 flex items-start gap-2 rounded-lg bg-muted px-4 py-3 text-xs leading-5 text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-foreground" />
            忘记当前密码时，请使用
            <Link className="font-medium text-primary" href="/forgot-password">邮件找回</Link>
            。
          </div>
        </section>
      </main>
    </WorkflowShell>
  );
}
