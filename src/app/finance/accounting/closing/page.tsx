import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Ban,
  CircleAlert,
  ClipboardCheck,
  LockKeyhole,
  RotateCcw,
} from "lucide-react";
import { WorkflowShell } from "@/features/approvals/workflow-shell";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import {
  acknowledgeAccountingCloseWarningsAction,
  generatePeriodClosingAction,
  requestPeriodReopeningAction,
} from "@/features/finance/accounting-actions";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "月末关账工作台",
  description: "会计期间检查、损益结转和受控反结账",
};
export const dynamic = "force-dynamic";

type Period = {
  id: string;
  name: string;
  starts_on: string;
  ends_on: string;
  status: string;
  closing_entry_id: string | null;
  reopening_entry_id: string | null;
  close_version: number;
};
type Entry = { id: string; entry_no: string; status: string };
type Check = {
  check_code: string;
  severity: "blocker" | "warning";
  issue_count: number;
  title: string;
  detail: string;
  action_href: string;
};

const errors: Record<string, string> = {
  invalid_confirmation: "请输入完整期间名称确认。",
  unposted_entries: "该期间仍有未过账业务凭证。",
  nothing_to_close: "该期间没有需要结转的损益余额。",
  already_generated: "该期间已经生成结转凭证。",
  invalid_warning_note: "请填写至少 5 个字的风险确认说明。",
  warning_ack_failed: "关账警告确认失败。",
  invalid_reopening: "请填写反结账原因并输入期间名称确认。",
  reopening_failed: "反结账申请失败，请检查期间和结转凭证状态。",
  period_order: "必须先处理更晚的已结账期间。",
  forbidden: "当前账号缺少对应关账权限。",
  closing_failed: "结转凭证生成失败，请检查期间状态和本年利润科目。",
};
const entryStatus: Record<string, string> = {
  draft: "待审核",
  reviewed: "待过账",
  posted: "已过账",
  reversed: "已反结转",
};
const periodStatus: Record<string, string> = {
  future: "未开放",
  open: "开放",
  closing: "结账中",
  closed: "已结账",
  reopening: "反结账中",
};

export default async function ClosingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string; period?: string }>;
}) {
  const employee = await requireCurrentEmployee();
  const params = await searchParams;
  const supabase = await createClient();
  const [generateAccess, reopenAccess, acknowledgeAccess] = await Promise.all([
    supabase.rpc("has_access_permission", { p_permission_code: "finance.closing.generate" }),
    supabase.rpc("has_access_permission", { p_permission_code: "finance.closing.reopen" }),
    supabase.rpc("has_access_permission", { p_permission_code: "finance.closing.acknowledge" }),
  ]);
  const canGenerate = generateAccess.data === true;
  const canReopen = reopenAccess.data === true || employee.roleCodes.includes("chairman");
  const canAcknowledge = acknowledgeAccess.data === true;
  const canView = canGenerate || canReopen || canAcknowledge;
  const { data: periodsData } = canView
    ? await supabase
        .from("fiscal_periods")
        .select("id, name, starts_on, ends_on, status, closing_entry_id, reopening_entry_id, close_version")
        .order("starts_on", { ascending: false })
        .limit(18)
    : { data: [] };
  const periods = (periodsData ?? []) as Period[];
  const selected = periods.find((period) => period.id === params.period) ?? periods[0];
  const linkedIds = periods.flatMap((period) => [period.closing_entry_id, period.reopening_entry_id]).filter((id): id is string => Boolean(id));
  const { data: entriesData } = linkedIds.length
    ? await supabase.from("journal_entries").select("id, entry_no, status").in("id", linkedIds)
    : { data: [] };
  const entries = new Map(((entriesData ?? []) as Entry[]).map((entry) => [entry.id, entry]));
  const { data: checksData, error: checksError } = selected
    ? await supabase.rpc("accounting_close_checklist", { p_period_id: selected.id })
    : { data: [], error: null };
  const checks = ((checksData ?? []) as Check[]).map((check) => ({ ...check, issue_count: Number(check.issue_count) }));
  const blockers = checks.filter((check) => check.severity === "blocker" && check.issue_count > 0);
  const warnings = checks.filter((check) => check.severity === "warning" && check.issue_count > 0);

  return (
    <WorkflowShell activeItem="财务总览" breadcrumb="财务管理 / 会计核算 / 月末关账" currentUser={{ name: employee.name, roleLabel: "关账工作台" }}>
      <main className="mx-auto max-w-[1320px] p-4 sm:p-6 xl:p-8">
        <section className="relative overflow-hidden rounded-[24px] bg-[#0a385d] px-6 py-7 text-white sm:px-8">
          <LockKeyhole className="absolute right-12 top-1/2 hidden size-32 -translate-y-1/2 text-white/[0.06] sm:block" />
          <Link className="inline-flex items-center gap-2 text-[10px] text-white/55 hover:text-white" href="/finance/accounting"><ArrowLeft className="size-3" />会计核算</Link>
          <div className="mt-5 text-[10px] tracking-[0.15em] text-[#79d8d5]">CLOSE CHECK · PROFIT TRANSFER · CONTROLLED REOPEN</div>
          <h1 className="mt-3 text-2xl font-semibold">月末关账工作台</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-white/55">先消除阻断项，再处理损益结转、风险确认和期间关闭；反结账必须通过独立审核与过账。</p>
        </section>

        {(params.error || params.saved) ? (
          <div className={`mt-5 flex items-center gap-2 rounded-xl border px-4 py-3 text-xs ${params.error ? "border-[#ead8d8] bg-[#f8eeee] text-[#965151]" : "border-[#b9dbce] bg-[#eef8f5] text-[#285f53]"}`}>
            {params.error ? <CircleAlert className="size-4" /> : <BadgeCheck className="size-4" />}
            {params.error ? errors[params.error] ?? "操作失败。" : params.saved === "warnings" ? "关账警告已确认并记录审计。" : "关账操作已完成。"}
          </div>
        ) : null}

        {!canView ? (
          <div className="mt-5 rounded-[22px] border border-border bg-white p-10 text-center text-sm text-[#965151]">暂无月末关账权限。</div>
        ) : (
          <div className="mt-5 grid gap-5 xl:grid-cols-[300px_1fr]">
            <aside className="rounded-[22px] border border-border bg-white p-3">
              <div className="px-3 py-2 text-xs font-semibold">会计期间</div>
              <div className="space-y-1">
                {periods.map((period) => (
                  <Link className={`block rounded-xl px-3 py-3 text-[10px] ${selected?.id === period.id ? "bg-[#eaf5f5] text-primary" : "hover:bg-muted"}`} href={`/finance/accounting/closing?period=${period.id}`} key={period.id}>
                    <div className="flex items-center justify-between"><span className="font-medium">{period.name}</span><span>{periodStatus[period.status] ?? period.status}</span></div>
                    <div className="mt-1 text-[9px] text-muted-foreground">{period.starts_on} 至 {period.ends_on}</div>
                  </Link>
                ))}
              </div>
            </aside>

            {selected ? (
              <div className="space-y-5">
                <section className="rounded-[22px] border border-border bg-white p-5 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div><h2 className="text-base font-semibold">{selected.name}</h2><p className="mt-1 text-[10px] text-muted-foreground">关账版本 {selected.close_version + 1} · {periodStatus[selected.status]}</p></div>
                    <span className={`rounded-full px-3 py-1.5 text-[9px] ${blockers.length ? "bg-[#f8eeee] text-[#965151]" : warnings.length ? "bg-[#fff4e7] text-[#9a6321]" : "bg-[#eef8f5] text-[#285f53]"}`}>{blockers.length ? `${blockers.length} 项阻断` : warnings.length ? `${warnings.length} 项警告` : "检查通过"}</span>
                  </div>
                  {checksError ? <div className="mt-4 rounded-xl bg-[#f8eeee] p-4 text-xs text-[#965151]">关账检查不可用，请确认数据库迁移已应用。</div> : (
                    <div className="mt-4 grid gap-2 md:grid-cols-2">
                      {checks.map((check) => {
                        const hasIssue = check.issue_count > 0;
                        const Icon = !hasIssue ? BadgeCheck : check.severity === "blocker" ? Ban : AlertTriangle;
                        return <Link className={`rounded-xl border p-4 ${!hasIssue ? "border-[#d9ebe5] bg-[#f7fbfa]" : check.severity === "blocker" ? "border-[#ead8d8] bg-[#fffafa]" : "border-[#ead9b8] bg-[#fffaf2]"}`} href={check.action_href} key={check.check_code}><div className="flex items-center gap-2"><Icon className={`size-4 ${!hasIssue ? "text-[#3d806d]" : check.severity === "blocker" ? "text-[#965151]" : "text-[#9a6321]"}`} /><span className="text-xs font-medium">{check.title}</span><span className="ml-auto text-[10px] tabular-nums">{check.issue_count}</span></div><p className="mt-2 text-[9px] leading-5 text-muted-foreground">{check.detail}</p></Link>;
                      })}
                    </div>
                  )}
                </section>

                {warnings.length && canAcknowledge ? (
                  <section className="rounded-[22px] border border-[#ead9b8] bg-white p-5 sm:p-6">
                    <div className="flex items-center gap-2 text-[#9a6321]"><ClipboardCheck className="size-4" /><h2 className="text-sm font-semibold">确认非阻断性风险</h2></div>
                    <form action={acknowledgeAccountingCloseWarningsAction} className="mt-4 flex flex-col gap-3 sm:flex-row"><input name="periodId" type="hidden" value={selected.id} /><input className="h-10 min-w-0 flex-1 rounded-xl border border-border px-3 text-xs" name="note" placeholder="填写确认依据和后续处理安排" required /><button className="h-10 rounded-xl bg-[#9a6321] px-4 text-xs text-white" type="submit">确认并留痕</button></form>
                  </section>
                ) : null}

                <section className="rounded-[22px] border border-border bg-white p-5 sm:p-6">
                  <h2 className="text-sm font-semibold">结转与反结账</h2>
                  <div className="mt-4 space-y-3">
                    {selected.closing_entry_id && entries.get(selected.closing_entry_id) ? (
                      <Link className="flex items-center justify-between rounded-xl border border-border bg-[#fafcfe] p-4 text-xs" href={`/finance/accounting/entries/${selected.closing_entry_id}`}><span>{entries.get(selected.closing_entry_id)?.entry_no}</span><span>{entryStatus[entries.get(selected.closing_entry_id)?.status ?? ""]}</span></Link>
                    ) : <div className="rounded-xl border border-dashed border-border p-4 text-xs text-muted-foreground">尚未生成损益结转凭证。</div>}
                    {selected.reopening_entry_id && entries.get(selected.reopening_entry_id) ? (
                      <Link className="flex items-center justify-between rounded-xl border border-[#ead9b8] bg-[#fffaf2] p-4 text-xs" href={`/finance/accounting/entries/${selected.reopening_entry_id}`}><span>{entries.get(selected.reopening_entry_id)?.entry_no}</span><span>{entryStatus[entries.get(selected.reopening_entry_id)?.status ?? ""]}</span></Link>
                    ) : null}
                  </div>
                  {selected.status === "open" && !selected.closing_entry_id && canGenerate ? (
                    <form action={generatePeriodClosingAction} className="mt-4 flex gap-2"><input name="periodId" type="hidden" value={selected.id} /><input className="h-10 min-w-0 flex-1 rounded-xl border border-border px-3 text-xs" name="confirmation" placeholder={`输入“${selected.name}”确认`} required /><button className="h-10 rounded-xl bg-primary px-4 text-xs text-primary-foreground" type="submit">生成结转草稿</button></form>
                  ) : null}
                  {selected.status === "closed" && selected.closing_entry_id && canReopen ? (
                    <form action={requestPeriodReopeningAction} className="mt-4 grid gap-2 lg:grid-cols-[1fr_220px_auto]"><input name="periodId" type="hidden" value={selected.id} /><input className="h-10 rounded-xl border border-[#ead8d8] px-3 text-xs" name="reason" placeholder="反结账原因（至少 5 个字）" required /><input className="h-10 rounded-xl border border-[#ead8d8] px-3 text-xs" name="confirmation" placeholder={`输入 ${selected.name} 确认`} required /><button className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#965151] px-4 text-xs text-white" type="submit"><RotateCcw className="size-4" />申请反结账</button></form>
                  ) : null}
                </section>
              </div>
            ) : <div className="rounded-[22px] border border-border bg-white p-10 text-center text-xs text-muted-foreground">暂无会计期间。</div>}
          </div>
        )}
      </main>
    </WorkflowShell>
  );
}
