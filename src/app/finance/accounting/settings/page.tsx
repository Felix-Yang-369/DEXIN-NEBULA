import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, BadgeCheck, CalendarRange, CircleAlert, Cog, Plus } from "lucide-react";
import { WorkflowShell } from "@/features/approvals/workflow-shell";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import { createFiscalYearAction, saveAccountingAccountAction, transitionFiscalPeriodAction } from "@/features/finance/accounting-actions";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "会计基础设置", description: "会计科目与期间治理" };
export const dynamic = "force-dynamic";

type Book = { id: string; code: string; name: string };
type Account = { id: string; code: string; name: string; category: string; normal_balance: string; allow_posting: boolean; requires_counterparty: boolean; requires_department: boolean; requires_project: boolean; status: string };
type Period = { id: string; fiscal_year: number; period_no: number; name: string; starts_on: string; ends_on: string; status: string; closed_at: string | null };
const categoryLabels: Record<string, string> = { asset: "资产", liability: "负债", equity: "所有者权益", cost: "成本", profit_loss: "损益" };
const statusLabels: Record<string, string> = { future: "未来", open: "开放", closing: "结账中", closed: "已结账", reopening: "反结账中" };
const errorMessages: Record<string, string> = {
  invalid_account: "科目内容不完整或格式无效。", duplicate_account: "当前账簿已存在相同科目编码。", account_in_use: "已使用科目不能修改编码、类别或余额方向。",
  account_failed: "科目保存失败。", invalid_period: "请选择期间操作并输入期间名称确认。", unposted_entries: "该期间仍有草稿或已审核未过账凭证。",
  period_order: "会计期间必须按时间顺序开放、结账或重新开放。", period_confirmation: "输入的期间名称不匹配。", closing_required: "该期间必须先生成、审核并过账损益结转凭证。", closing_reopen_blocked: "含已过账损益结转的期间暂不支持直接反结账，避免结转重复。", period_failed: "期间操作失败。", forbidden: "当前账号缺少对应管理权限。",
  closing_blockers: "该期间仍有关账阻断项，请先在月末关账工作台处理。", closing_warnings_unacknowledged: "该期间存在未确认的关账警告。",
  invalid_year: "会计年度无效、超出允许范围或已经存在。",
};

function AccountFields({ account }: { account?: Account }) {
  return <>
    <input name="accountId" type="hidden" value={account?.id ?? ""} />
    <div className="grid gap-3 sm:grid-cols-2"><input className="h-9 rounded-lg border border-border px-3 text-xs" defaultValue={account?.code} name="code" pattern="[0-9]{4,12}" placeholder="科目编码" required /><input className="h-9 rounded-lg border border-border px-3 text-xs" defaultValue={account?.name} name="name" placeholder="科目名称" required /></div>
    <div className="mt-3 grid gap-3 sm:grid-cols-3"><select className="h-9 rounded-lg border border-border px-3 text-xs" defaultValue={account?.category ?? "asset"} name="category">{Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><select className="h-9 rounded-lg border border-border px-3 text-xs" defaultValue={account?.normal_balance ?? "debit"} name="normalBalance"><option value="debit">借方余额</option><option value="credit">贷方余额</option></select><select className="h-9 rounded-lg border border-border px-3 text-xs" defaultValue={account?.status ?? "active"} name="status"><option value="active">启用</option><option value="inactive">停用</option></select></div>
    <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground"><label><input className="mr-1" defaultChecked={account?.allow_posting ?? true} name="allowPosting" type="checkbox" />允许记账</label><label><input className="mr-1" defaultChecked={account?.requires_counterparty} name="requiresCounterparty" type="checkbox" />客户/供应商辅助核算</label><label><input className="mr-1" defaultChecked={account?.requires_department} name="requiresDepartment" type="checkbox" />部门辅助核算</label><label><input className="mr-1" defaultChecked={account?.requires_project} name="requiresProject" type="checkbox" />项目辅助核算</label></div>
  </>;
}

export default async function AccountingSettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const employee = await requireCurrentEmployee(); const params = await searchParams; const supabase = await createClient();
  const [accountManage, periodManage, periodClose] = await Promise.all([
    supabase.rpc("has_access_permission", { p_permission_code: "finance.account.manage" }),
    supabase.rpc("has_access_permission", { p_permission_code: "finance.period.manage" }),
    supabase.rpc("has_access_permission", { p_permission_code: "finance.period.close" }),
  ]);
  const canManageAccounts = accountManage.data === true; const canManagePeriods = periodManage.data === true; const canClosePeriods = periodClose.data === true; const canReopen = employee.roleCodes.includes("chairman");
  const canView = canManageAccounts || canManagePeriods || canClosePeriods || canReopen;
  const [{ data: booksData }, { data: accountsData }, { data: periodsData }] = canView ? await Promise.all([
    supabase.from("accounting_books").select("id, code, name").eq("status", "active").order("code"),
    supabase.from("accounting_accounts").select("id, code, name, category, normal_balance, allow_posting, requires_counterparty, requires_department, requires_project, status").order("code"),
    supabase.from("fiscal_periods").select("id, fiscal_year, period_no, name, starts_on, ends_on, status, closed_at").order("starts_on"),
  ]) : [{ data: [] }, { data: [] }, { data: [] }];
  const books = (booksData ?? []) as Book[]; const accounts = (accountsData ?? []) as Account[]; const periods = (periodsData ?? []) as Period[]; const book = books[0];

  return <WorkflowShell activeItem="财务总览" breadcrumb="财务管理 / 会计核算 / 基础设置" currentUser={{ name: employee.name, roleLabel: "会计设置" }}><main className="mx-auto max-w-[1440px] p-4 sm:p-6 xl:p-8">
    <section className="ui-page-header"><Cog className="absolute right-12 top-1/2 hidden size-32 -translate-y-1/2 text-white/[0.06] sm:block" /><Link className="inline-flex items-center gap-2 text-xs text-white/55 hover:text-white" href="/finance/accounting"><ArrowLeft className="size-3" />会计核算</Link><div className="mt-5 text-xs tracking-[0.15em] text-muted-foreground">CHART OF ACCOUNTS · FISCAL PERIOD</div><h1 className="mt-3 text-2xl font-semibold">会计基础设置</h1><p className="mt-3 text-sm text-white/55">管理科目启用状态、辅助核算要求和会计期间生命周期。</p></section>
    {!canView ? <div className="mt-5 rounded-md border border-border bg-white p-10 text-center text-sm text-foreground">暂无会计基础设置权限。</div> : <>
      {(params.error || params.saved) && <div className={`mt-5 flex items-center gap-2 rounded-md border px-4 py-3 text-xs ${params.error ? "border-border bg-muted text-foreground" : "border-border bg-muted text-foreground"}`}>{params.error ? <CircleAlert className="size-4" /> : <BadgeCheck className="size-4" />}{params.error ? errorMessages[params.error] ?? "操作失败。" : "会计基础设置已保存并记录审计。"}</div>}
      <section className="mt-5 grid gap-5 xl:grid-cols-[1.2fr_1fr]">
        <div className="rounded-md border border-border bg-white p-5 sm:p-6" id="accounts"><div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold">会计科目</h2><p className="mt-1 text-xs text-muted-foreground">{book?.name ?? "未初始化账簿"} · {accounts.length} 个科目</p></div></div>
          {canManageAccounts && book && <details className="mt-4 rounded-md border border-border bg-muted p-4"><summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-medium text-foreground"><Plus className="size-4" />新增会计科目</summary><form action={saveAccountingAccountAction} className="mt-4"><input name="bookId" type="hidden" value={book.id} /><AccountFields /><button className="mt-4 h-9 rounded-lg bg-primary px-4 text-xs text-primary-foreground" type="submit">保存科目</button></form></details>}
          <div className="mt-4 space-y-2">{accounts.map((account) => <details className="rounded-md border border-border bg-muted" key={account.id}><summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3"><span className="font-mono text-xs text-primary">{account.code}</span><span className="flex-1 text-xs font-medium">{account.name}</span><span className="text-xs text-muted-foreground">{categoryLabels[account.category]} · {account.status === "active" ? "启用" : "停用"}</span></summary>{canManageAccounts && book && <form action={saveAccountingAccountAction} className="border-t border-border bg-white p-4"><input name="bookId" type="hidden" value={book.id} /><AccountFields account={account} /><button className="mt-4 h-9 rounded-lg border border-primary px-4 text-xs text-primary" type="submit">保存修改</button></form>}</details>)}</div>
        </div>
        <div className="rounded-md border border-border bg-white p-5 sm:p-6" id="periods"><div className="flex items-center gap-2"><CalendarRange className="size-4 text-primary" /><h2 className="text-sm font-semibold">会计期间</h2></div><p className="mt-2 text-xs leading-5 text-muted-foreground">开放、结账和反结账均要求输入期间名称确认，并遵循时间顺序。</p>{canManagePeriods && book && <form action={createFiscalYearAction} className="mt-4 flex gap-2 rounded-md border border-border bg-muted p-3"><input name="bookId" type="hidden" value={book.id} /><input className="h-9 min-w-0 flex-1 rounded-lg border border-border px-3 text-xs" defaultValue={new Date().getFullYear() + 1} max={new Date().getFullYear() + 5} min={new Date().getFullYear() - 1} name="fiscalYear" type="number" /><button className="h-9 rounded-lg border border-primary px-3 text-xs text-primary" type="submit">创建会计年度</button></form>}
          <div className="mt-4 space-y-2">{periods.map((period) => { const action = period.status === "future" && canManagePeriods ? "open" : period.status === "open" && canClosePeriods ? "close" : null; return <div className="rounded-md border border-border bg-muted p-4" key={period.id}><div className="flex items-center justify-between"><div><div className="text-xs font-medium">{period.name}</div><div className="mt-1 text-xs text-muted-foreground">{period.starts_on} 至 {period.ends_on}</div></div><span className="rounded-full bg-muted px-2.5 py-1 text-xs text-foreground">{statusLabels[period.status]}</span></div>{action && <form action={transitionFiscalPeriodAction} className="mt-3 flex gap-2"><input name="periodId" type="hidden" value={period.id} /><input name="action" type="hidden" value={action} /><input className="h-8 min-w-0 flex-1 rounded-lg border border-border px-2 text-xs" name="confirmation" placeholder={`输入“${period.name}”确认`} required /><button className="h-8 rounded-lg border border-border bg-white px-3 text-xs text-primary" type="submit">{action === "open" ? "开放" : "结账"}</button></form>}{period.status === "closed" && canReopen ? <Link className="mt-3 inline-flex h-8 items-center rounded-lg border border-border bg-white px-3 text-xs text-foreground" href={`/finance/accounting/closing?period=${period.id}`}>前往关账工作台发起反结账</Link> : null}</div>; })}</div>
        </div>
      </section>
    </>}
  </main></WorkflowShell>;
}
