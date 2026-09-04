import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, BadgeCheck, BarChart3, BookOpen, BookOpenCheck, CalendarClock, CalendarRange, CircleAlert, DatabaseZap, FileCheck2, Landmark, Scale, Settings2 } from "lucide-react";
import { WorkflowShell } from "@/features/approvals/workflow-shell";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import { transitionAccountingJournalAction } from "@/features/finance/accounting-actions";
import { JournalEntryForm } from "@/features/finance/journal-entry-form";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "会计核算", description: "会计账簿、期间、科目和正式多行凭证" };
export const dynamic = "force-dynamic";

type Book = { id: string; code: string; name: string; base_currency: string; accounting_standard: string };
type Period = { id: string; fiscal_year: number; period_no: number; name: string; starts_on: string; ends_on: string; status: string };
type Account = { id: string; code: string; name: string; category: string; normal_balance: string };
type Entry = { id: string; entry_no: string; entry_date: string; summary: string; source_type: string; status: string; total_debit: number; total_credit: number; attachment_count: number; version: number; creator: { name: string } | { name: string }[] | null };

const errorMessages: Record<string, string> = {
  forbidden: "只有财务角色可以处理正式会计凭证。", invalid_entry: "凭证内容不完整或分录格式无效。", unbalanced: "凭证借贷金额必须相等且大于零。",
  period_closed: "凭证日期不在开放会计期间。", self_review: "制单人不能审核或过账本人创建的凭证。", stale: "凭证已被其他人处理，请刷新后重试。",
  invalid_transition: "当前凭证状态不允许执行该操作。", operation_failed: "凭证操作失败，请稍后重试。",
};
const statusLabels: Record<string, string> = { draft: "草稿", reviewed: "已审核", posted: "已过账", reversed: "已冲销", void: "作废" };
const statusTones: Record<string, string> = { draft: "bg-[#edf2f7] text-[#42647a]", reviewed: "bg-[#fff4e7] text-[#9a6321]", posted: "bg-[#eef8f5] text-[#285f53]", reversed: "bg-[#f3eef8] text-[#77518e]", void: "bg-[#f8eeee] text-[#965151]" };
function relationName(value: Entry["creator"]) { return (Array.isArray(value) ? value[0] : value)?.name ?? "系统"; }

export default async function AccountingPage({ searchParams }: { searchParams: Promise<{ saved?: string; transitioned?: string; error?: string }> }) {
  const employee = await requireCurrentEmployee();
  const params = await searchParams;
  const supabase = await createClient();
  const accessChecks = await Promise.all([
    "finance.voucher.create", "finance.voucher.review", "finance.voucher.post", "finance.report.export",
    "finance.ledger.view", "finance.account.manage", "finance.period.manage", "finance.period.close",
    "finance.opening.manage", "finance.closing.generate", "finance.statement.view",
  ].map((code) => supabase.rpc("has_access_permission", { p_permission_code: code })));
  const canView = accessChecks.some((result) => result.data === true);
  const canCreate = accessChecks[0]?.data === true;
  const canReview = accessChecks[1]?.data === true;
  const canPost = accessChecks[2]?.data === true;
  const canViewLedger = accessChecks[4]?.data === true;
  const canManageSettings = accessChecks.slice(5).some((result) => result.data === true) || employee.roleCodes.includes("chairman");
  const canManageOpening = accessChecks[8]?.data === true; const canGenerateClosing = accessChecks[9]?.data === true; const canViewStatements = accessChecks[10]?.data === true;
  const [{ data: booksData }, { data: periodsData }, { data: accountsData }, { data: entriesData }] = canView ? await Promise.all([
    supabase.from("accounting_books").select("id, code, name, base_currency, accounting_standard").eq("status", "active").order("code"),
    supabase.from("fiscal_periods").select("id, fiscal_year, period_no, name, starts_on, ends_on, status").order("starts_on", { ascending: false }).limit(18),
    supabase.from("accounting_accounts").select("id, code, name, category, normal_balance").eq("status", "active").eq("allow_posting", true).order("code"),
    supabase.from("journal_entries").select("id, entry_no, entry_date, summary, source_type, status, total_debit, total_credit, attachment_count, version, creator:employees!journal_entries_created_by_employee_id_fkey(name)").order("entry_date", { ascending: false }).order("created_at", { ascending: false }).limit(50),
  ]) : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];
  const books = (booksData ?? []) as Book[]; const periods = (periodsData ?? []) as Period[]; const accounts = (accountsData ?? []) as Account[]; const entries = (entriesData ?? []) as Entry[];
  const currentBook = books[0]; const openPeriods = periods.filter((period) => period.status === "open");
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(new Date());

  return <WorkflowShell activeItem="财务总览" breadcrumb="财务管理 / 会计核算" currentUser={{ name: employee.name, roleLabel: canView ? "财务核算" : "内部员工" }}>
    <main className="mx-auto max-w-[1500px] p-4 sm:p-6 xl:p-8">
      <section className="relative overflow-hidden rounded-[24px] bg-[#0a385d] px-6 py-8 text-white sm:px-8">
        <Scale className="absolute right-12 top-1/2 hidden size-36 -translate-y-1/2 text-white/[0.06] sm:block" />
        <Link className="inline-flex items-center gap-2 text-[10px] text-white/55 hover:text-white" href="/finance"><ArrowLeft className="size-3" />财务管理中心</Link>
        <div className="mt-5 flex flex-wrap items-end justify-between gap-5"><div><div className="text-[10px] tracking-[0.15em] text-[#79d8d5]">GENERAL LEDGER · PERIOD · STATEMENT</div><h1 className="mt-3 text-2xl font-semibold">会计核算内核 V3</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-white/55">在正式账簿、期间和凭证基础上，加入期初迁移、受控损益结转与三大财务报表。</p></div><div className="flex flex-wrap gap-2">{canViewStatements && <Link className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/15 bg-white/8 px-4 text-xs" href="/finance/accounting/statements"><BarChart3 className="size-4" />财务报表</Link>}{canViewLedger && <Link className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/15 bg-white/8 px-4 text-xs" href="/finance/accounting/ledger"><BookOpen className="size-4" />会计账簿</Link>}{canManageSettings && <Link className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/15 bg-white/8 px-4 text-xs" href="/finance/accounting/settings"><Settings2 className="size-4" />基础设置</Link>}</div></div>
      </section>
      {!canView ? <div className="mt-5 rounded-[20px] border border-[#ead8d8] bg-white p-10 text-center text-sm text-[#965151]">暂无会计核算访问权限。</div> : <>
        {(params.error || params.saved || params.transitioned) && <div className={`mt-5 flex items-center gap-2 rounded-xl border px-4 py-3 text-xs ${params.error ? "border-[#ead8d8] bg-[#f8eeee] text-[#965151]" : "border-[#b9dbce] bg-[#eef8f5] text-[#285f53]"}`}>{params.error ? <CircleAlert className="size-4" /> : <BadgeCheck className="size-4" />}{params.error ? errorMessages[params.error] ?? "操作失败。" : params.saved ? `凭证 ${params.saved} 已保存为草稿。` : params.transitioned === "review" ? "凭证已审核。" : "凭证已完成不可逆过账。"}</div>}
        <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[{ icon: Landmark, label: "当前账簿", value: currentBook?.name ?? "未初始化", note: currentBook ? `${currentBook.code} · ${currentBook.base_currency}` : "" }, { icon: CalendarRange, label: "开放期间", value: `${openPeriods.length} 个`, note: openPeriods[0]?.name ?? "暂无" }, { icon: BookOpenCheck, label: "启用科目", value: `${accounts.length} 个`, note: "企业会计准则科目基线" }, { icon: FileCheck2, label: "正式凭证", value: `${entries.length} 张`, note: `${entries.filter((entry) => entry.status === "posted").length} 张已过账` }].map((item) => { const Icon = item.icon; return <article className="rounded-[18px] border border-border bg-white p-5" key={item.label}><Icon className="size-4 text-primary" /><div className="mt-4 text-[10px] text-muted-foreground">{item.label}</div><div className="mt-1 text-lg font-semibold">{item.value}</div><div className="mt-2 text-[9px] text-muted-foreground">{item.note}</div></article>; })}
        </section>
        {(canManageOpening || canGenerateClosing) && <section className="mt-5 grid gap-3 md:grid-cols-2">{canManageOpening && <Link className="group rounded-[18px] border border-border bg-white p-5 hover:border-primary/40" href="/finance/accounting/opening"><DatabaseZap className="size-4 text-primary" /><div className="mt-3 text-sm font-semibold">期初余额迁移</div><p className="mt-2 text-[10px] leading-5 text-muted-foreground">在年度首次记账前导入已平衡期初余额。</p></Link>}{canGenerateClosing && <Link className="group rounded-[18px] border border-border bg-white p-5 hover:border-primary/40" href="/finance/accounting/closing"><CalendarClock className="size-4 text-primary" /><div className="mt-3 text-sm font-semibold">期末损益结转</div><p className="mt-2 text-[10px] leading-5 text-muted-foreground">生成结转草稿并跟踪审核、过账与结账准备度。</p></Link>}</section>}
        <section className="mt-5 rounded-[22px] border border-border bg-white p-5 sm:p-6" id="new-entry"><h2 className="text-sm font-semibold">新增会计凭证</h2><p className="mt-2 text-[10px] leading-5 text-muted-foreground">当前仅保存草稿；数据库会再次校验开放期间、科目归属、每行单边金额和整张凭证借贷平衡。</p>{!canCreate ? <div className="mt-5 rounded-xl bg-[#fff9ef] p-5 text-xs text-[#9a6321]">当前账号可以查看核算数据，但没有凭证制单权限。</div> : currentBook && accounts.length >= 2 ? <JournalEntryForm accounts={accounts} bookId={currentBook.id} today={today} /> : <div className="mt-5 rounded-xl bg-[#fff9ef] p-5 text-xs text-[#9a6321]">账簿或会计科目尚未初始化，请先执行本批数据库迁移。</div>}</section>
        <section className="mt-5 rounded-[22px] border border-border bg-white p-5 sm:p-6" id="entries"><h2 className="text-sm font-semibold">凭证工作台</h2><div className="mt-4 overflow-x-auto rounded-xl border border-border"><table className="w-full min-w-[900px] text-left text-[10px]"><thead className="bg-[#f5f8fa] text-muted-foreground"><tr><th className="p-3">凭证号</th><th className="p-3">日期</th><th className="p-3">摘要</th><th className="p-3 text-right">借方</th><th className="p-3 text-right">贷方</th><th className="p-3">制单人</th><th className="p-3">状态</th><th className="p-3">操作</th></tr></thead><tbody>
          {entries.map((entry) => { const allowedTransition = entry.status === "draft" ? canReview : entry.status === "reviewed" ? canPost : false; return <tr className="border-t border-border" key={entry.id}><td className="p-3"><Link className="font-mono text-primary hover:underline" href={`/finance/accounting/entries/${entry.id}`}>{entry.entry_no}</Link></td><td className="p-3">{entry.entry_date}</td><td className="max-w-72 p-3">{entry.summary}<div className="mt-1 text-[9px] text-muted-foreground">{entry.source_type === "period_close_reversal" ? "反结账受控凭证" : `附件 ${entry.attachment_count}`}</div></td><td className="p-3 text-right tabular-nums">¥{Number(entry.total_debit).toFixed(2)}</td><td className="p-3 text-right tabular-nums">¥{Number(entry.total_credit).toFixed(2)}</td><td className="p-3">{relationName(entry.creator)}</td><td className="p-3"><span className={`rounded-full px-2.5 py-1 ${statusTones[entry.status] ?? "bg-[#edf2f7]"}`}>{statusLabels[entry.status] ?? entry.status}</span></td><td className="p-3">{allowedTransition ? <form action={transitionAccountingJournalAction}><input name="entryId" type="hidden" value={entry.id} /><input name="version" type="hidden" value={entry.version} /><input name="sourceType" type="hidden" value={entry.source_type} /><input name="action" type="hidden" value={entry.status === "draft" ? "review" : "post"} /><button className="rounded-lg border border-border px-3 py-1.5 text-[9px] text-primary" type="submit">{entry.status === "draft" ? "审核" : "过账"}</button></form> : <Link className="text-primary hover:underline" href={`/finance/accounting/entries/${entry.id}`}>查看明细</Link>}</td></tr>; })}
          {!entries.length && <tr><td className="p-10 text-center text-muted-foreground" colSpan={8}>暂无正式会计凭证。</td></tr>}
        </tbody></table></div></section>
      </>}
    </main>
  </WorkflowShell>;
}
