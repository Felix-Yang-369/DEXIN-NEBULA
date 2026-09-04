import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CircleAlert, DatabaseZap } from "lucide-react";
import { WorkflowShell } from "@/features/approvals/workflow-shell";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import { OpeningBalanceForm } from "@/features/finance/opening-balance-form";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "期初余额", description: "将已平衡期初数据迁入正式账簿" };
export const dynamic = "force-dynamic";
type Book = { id: string; name: string }; type Account = { id: string; code: string; name: string }; type Period = { fiscal_year: number; status: string }; type Entry = { id: string; entry_no: string; status: string; summary: string };
const errors: Record<string, string> = { invalid_opening: "期初余额格式无效。", unbalanced: "期初借贷金额必须相等且大于零。", year_in_use: "该年度已有凭证，不能再导入期初余额。", forbidden: "当前账号缺少期初余额管理权限。", opening_failed: "期初余额生成失败，请检查账簿和首期期间状态。" };

export default async function OpeningPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const employee = await requireCurrentEmployee(); const params = await searchParams; const supabase = await createClient();
  const { data: canManage } = await supabase.rpc("has_access_permission", { p_permission_code: "finance.opening.manage" });
  const [{ data: booksData }, { data: accountsData }, { data: periodsData }, { data: entriesData }] = canManage === true ? await Promise.all([
    supabase.from("accounting_books").select("id, name").eq("status", "active").limit(1),
    supabase.from("accounting_accounts").select("id, code, name").eq("status", "active").eq("allow_posting", true).order("code"),
    supabase.from("fiscal_periods").select("fiscal_year, status").eq("period_no", 1).order("fiscal_year", { ascending: false }),
    supabase.from("journal_entries").select("id, entry_no, status, summary").eq("is_opening", true).order("entry_date", { ascending: false }),
  ]) : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];
  const book = (booksData as Book[] | null)?.[0]; const accounts = (accountsData ?? []) as Account[]; const periods = (periodsData ?? []) as Period[]; const entries = (entriesData ?? []) as Entry[];
  const eligible = periods.find((period) => period.status === "open" && !entries.some((entry) => entry.entry_no === `期初-${period.fiscal_year}`));
  return <WorkflowShell activeItem="财务总览" breadcrumb="财务管理 / 会计核算 / 期初余额" currentUser={{ name: employee.name, roleLabel: "期初迁移" }}><main className="mx-auto max-w-[1200px] p-4 sm:p-6 xl:p-8"><section className="relative overflow-hidden rounded-[24px] bg-[#0a385d] px-6 py-7 text-white sm:px-8"><DatabaseZap className="absolute right-12 top-1/2 hidden size-32 -translate-y-1/2 text-white/[0.06] sm:block" /><Link className="inline-flex items-center gap-2 text-[10px] text-white/55 hover:text-white" href="/finance/accounting"><ArrowLeft className="size-3" />会计核算</Link><div className="mt-5 text-[10px] tracking-[0.15em] text-[#79d8d5]">OPENING BALANCE · CONTROLLED MIGRATION</div><h1 className="mt-3 text-2xl font-semibold">期初余额迁移</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-white/55">仅允许在年度尚无其他凭证时生成一次期初草稿，仍需另一位财务人员审核和过账。</p></section>
    {params.error && <div className="mt-5 flex items-center gap-2 rounded-xl border border-[#ead8d8] bg-[#f8eeee] px-4 py-3 text-xs text-[#965151]"><CircleAlert className="size-4" />{errors[params.error] ?? "操作失败。"}</div>}
    {canManage !== true ? <div className="mt-5 rounded-[22px] border border-border bg-white p-10 text-center text-sm text-[#965151]">暂无期初余额管理权限。</div> : <><section className="mt-5 rounded-[22px] border border-border bg-white p-5 sm:p-6"><h2 className="text-sm font-semibold">录入期初余额</h2><p className="mt-2 text-[10px] leading-5 text-muted-foreground">选择开放年度首期，按科目录入借方或贷方余额。生成后不能用普通冲销流程撤销。</p>{book && eligible && accounts.length >= 2 ? <OpeningBalanceForm accounts={accounts} bookId={book.id} fiscalYear={eligible.fiscal_year} /> : <div className="mt-5 rounded-xl bg-[#fff9ef] p-5 text-xs text-[#9a6321]">没有可迁移的开放年度，或该年度已经开始记账。</div>}</section><section className="mt-5 rounded-[22px] border border-border bg-white p-5 sm:p-6"><h2 className="text-sm font-semibold">历史期初凭证</h2><div className="mt-4 space-y-2">{entries.map((entry) => <Link className="flex items-center justify-between rounded-xl border border-border p-4 text-xs hover:border-primary/40" href={`/finance/accounting/entries/${entry.id}`} key={entry.id}><span><span className="font-mono text-primary">{entry.entry_no}</span><span className="ml-3">{entry.summary}</span></span><span className="text-muted-foreground">{entry.status}</span></Link>)}{!entries.length && <div className="rounded-xl bg-[#fafcfe] p-6 text-center text-xs text-muted-foreground">暂无期初凭证。</div>}</div></section></>}
  </main></WorkflowShell>;
}
