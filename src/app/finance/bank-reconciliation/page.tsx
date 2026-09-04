import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Banknote, CheckCircle2, CircleDollarSign, Link2, Unlink } from "lucide-react";
import { WorkflowShell } from "@/features/approvals/workflow-shell";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import {
  reconcileBankStatementLineAction,
  registerBankStatementLineAction,
} from "@/features/procurement/server-actions";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "银行流水与核销",
  description: "银行流水登记、应收应付匹配与核销",
};

export const dynamic = "force-dynamic";

type BankLine = {
  id: string;
  bank_account_name: string;
  transaction_date: string;
  direction: "inflow" | "outflow";
  counterparty_name: string | null;
  summary: string | null;
  bank_reference: string | null;
  amount: number;
  reconciled_amount: number;
  status: string;
};

type FinanceDocument = {
  id: string;
  document_no: string;
  document_type: "receivable" | "payable";
  counterparty_name: string;
  source_type: string;
  source_no: string | null;
  total_amount: number;
  settled_amount: number;
  due_date: string;
  status: string;
};

function money(value: number) {
  return new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY" }).format(Number(value ?? 0));
}

function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(new Date());
}

const statusLabels: Record<string, [string, string]> = {
  unmatched: ["待匹配", "bg-muted text-foreground"],
  partial: ["部分匹配", "bg-muted text-foreground"],
  matched: ["已核销", "bg-muted text-foreground"],
  ignored: ["已忽略", "bg-muted text-muted-foreground"],
};

export default async function BankReconciliationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const employee = await requireCurrentEmployee();
  const feedback = await searchParams;
  const canRead = employee.roleCodes.some((role) => ["finance", "chairman"].includes(role));
  const canFinance = employee.roleCodes.includes("finance");
  const supabase = await createClient();
  const [linesResult, documentsResult, reconciliationsResult] = canRead
    ? await Promise.all([
        supabase.from("bank_statement_lines").select("id, bank_account_name, transaction_date, direction, counterparty_name, summary, bank_reference, amount, reconciled_amount, status").order("transaction_date", { ascending: false }).limit(300),
        supabase.from("finance_documents").select("id, document_no, document_type, counterparty_name, source_type, source_no, total_amount, settled_amount, due_date, status").in("status", ["open", "partial"]).order("due_date").limit(500),
        supabase.from("bank_reconciliations").select("id, amount, reconciled_on").order("created_at", { ascending: false }).limit(100),
      ])
    : [{ data: [], error: null }, { data: [], error: null }, { data: [], error: null }];
  const lines = (linesResult.data ?? []) as BankLine[];
  const documents = (documentsResult.data ?? []) as FinanceDocument[];
  const unmatched = lines.filter((line) => !["matched", "ignored"].includes(line.status));
  const totalUnmatched = unmatched.reduce((sum, line) => sum + Number(line.amount) - Number(line.reconciled_amount), 0);
  const migrationMissing = linesResult.error?.code === "42P01" || linesResult.error?.code === "PGRST205";

  return (
    <WorkflowShell activeItem="资金管理" breadcrumb="财务管理 / 资金管理 / 银行流水与核销" currentUser={{ name: employee.name, roleLabel: employee.title ?? "内部员工" }}>
      <main className="mx-auto max-w-[1440px] p-4 sm:p-6 xl:p-8">
        <section className="ui-page-header">
          <Banknote className="absolute right-10 top-1/2 hidden size-40 -translate-y-1/2 text-white/[0.06] sm:block" />
          <div className="relative"><Link className="inline-flex items-center gap-1 text-xs text-white/55" href="/finance"><ArrowLeft className="size-3" /> 返回财务中心</Link><div className="mt-4 text-xs tracking-[0.18em] text-muted-foreground">BANK STATEMENT · RECONCILIATION</div><h1 className="mt-3 text-2xl font-semibold sm:text-[30px]">银行流水与核销</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-white/60">银行流水先作为独立原始凭据登记，再与应收应付逐笔匹配；核销事务同步生成收支记录、结算单和已过账凭证。</p></div>
        </section>

        {(feedback.error || feedback.created) && <div className={`mt-4 rounded-md border px-4 py-3 text-xs ${feedback.error ? "border-border bg-muted text-foreground" : "border-border bg-muted text-foreground"}`}>{feedback.error ?? feedback.created}</div>}
        {!canRead && <div className="mt-4 rounded-md border border-border bg-muted px-4 py-3 text-xs text-foreground">银行流水和核销仅财务主管与董事长可查看。</div>}
        {migrationMissing && <div className="mt-4 rounded-md border border-border bg-muted px-4 py-3 text-xs text-foreground">V0.9 银行核销迁移尚未执行。</div>}

        <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "银行流水", value: lines.length, icon: CircleDollarSign, note: "当前权限范围" },
            { label: "待匹配", value: unmatched.length, icon: Unlink, note: money(totalUnmatched) },
            { label: "已核销流水", value: lines.filter((line) => line.status === "matched").length, icon: CheckCircle2, note: "全额完成" },
            { label: "核销记录", value: reconciliationsResult.data?.length ?? 0, icon: Link2, note: "逐笔可追溯" },
          ].map(({ label, value, icon: Icon, note }) => <div className="rounded-md border border-border/70 bg-white p-4" key={label}><div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">{label}</span><Icon className="size-4 text-foreground" /></div><div className="mt-3 text-xl font-semibold text-foreground">{value}</div><div className="mt-1 text-xs text-muted-foreground">{note}</div></div>)}
        </section>

        {canFinance && <section className="mt-6 rounded-md border border-border/70 bg-white p-5"><div className="mb-4"><div className="text-sm font-semibold text-foreground">登记银行流水</div><div className="mt-1 text-xs text-muted-foreground">现阶段支持手工登记；下一步可增加银行 Excel 批量导入与自动匹配建议。</div></div><form action={registerBankStatementLineAction} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><label className="text-xs text-muted-foreground">公司银行账户<input className="mt-1.5 h-10 w-full rounded-md border border-border px-3 text-xs" name="bankAccountName" placeholder="例如：长沙银行基本户" required /></label><label className="text-xs text-muted-foreground">交易日期<input className="mt-1.5 h-10 w-full rounded-md border border-border px-3 text-xs" defaultValue={today()} name="transactionDate" required type="date" /></label><label className="text-xs text-muted-foreground">收支方向<select className="mt-1.5 h-10 w-full rounded-md border border-border bg-white px-3 text-xs" name="direction"><option value="outflow">付款 / 流出</option><option value="inflow">收款 / 流入</option></select></label><label className="text-xs text-muted-foreground">金额<input className="mt-1.5 h-10 w-full rounded-md border border-border px-3 text-xs" min="0.01" name="amount" required step="0.01" type="number" /></label><label className="text-xs text-muted-foreground">交易对方<input className="mt-1.5 h-10 w-full rounded-md border border-border px-3 text-xs" name="counterpartyName" /></label><label className="text-xs text-muted-foreground">银行流水号<input className="mt-1.5 h-10 w-full rounded-md border border-border px-3 text-xs" name="bankReference" /></label><label className="text-xs text-muted-foreground sm:col-span-2">摘要<input className="mt-1.5 h-10 w-full rounded-md border border-border px-3 text-xs" name="summary" /></label><div className="sm:col-span-2 xl:col-span-4"><button className="rounded-md bg-primary px-5 py-2.5 text-xs font-semibold text-white" type="submit">登记流水</button></div></form></section>}

        <section id="bank-lines" className="mt-6 rounded-md border border-border/70 bg-white p-5"><div className="mb-4 flex items-center justify-between"><div><div className="text-sm font-semibold text-foreground">银行流水台账</div><div className="mt-1 text-xs text-muted-foreground">可部分匹配多笔往来单据，余额实时计算。</div></div><span className="text-xs text-muted-foreground">{lines.length} 条</span></div><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-xs"><thead><tr className="border-b border-border text-xs text-muted-foreground"><th className="pb-3 font-medium">日期 / 流水号</th><th className="pb-3 font-medium">账户</th><th className="pb-3 font-medium">交易对方</th><th className="pb-3 font-medium">方向</th><th className="pb-3 text-right font-medium">金额</th><th className="pb-3 text-right font-medium">未匹配</th><th className="pb-3 text-right font-medium">状态</th></tr></thead><tbody>{lines.map((line) => { const status = statusLabels[line.status] ?? [line.status, "bg-muted"]; const remaining = Number(line.amount) - Number(line.reconciled_amount); return <tr className="border-b border-border/60 last:border-0" key={line.id}><td className="py-3"><div>{line.transaction_date}</div><div className="mt-1 text-xs text-muted-foreground">{line.bank_reference ?? "无银行流水号"}</div></td><td className="py-3">{line.bank_account_name}</td><td className="py-3"><div>{line.counterparty_name ?? "未填写"}</div><div className="mt-1 text-xs text-muted-foreground">{line.summary ?? ""}</div></td><td className={`py-3 font-medium ${line.direction === "inflow" ? "text-foreground" : "text-foreground"}`}>{line.direction === "inflow" ? "收款" : "付款"}</td><td className="py-3 text-right font-semibold">{money(line.amount)}</td><td className="py-3 text-right">{money(remaining)}</td><td className="py-3 text-right"><span className={`rounded-lg px-2 py-1 text-xs ${status[1]}`}>{status[0]}</span></td></tr>; })}</tbody></table>{!lines.length && <div className="py-12 text-center text-xs text-muted-foreground">暂无银行流水</div>}</div></section>

        {canFinance && <section id="reconcile" className="mt-6 rounded-md border border-border/70 bg-white p-5"><div className="mb-4"><div className="text-sm font-semibold text-foreground">待核销匹配</div><div className="mt-1 text-xs text-muted-foreground">付款流水只能匹配应付，收款流水只能匹配应收；金额不得超过双方未核销余额。</div></div><div className="space-y-3">{unmatched.map((line) => { const compatible = documents.filter((document) => line.direction === "outflow" ? document.document_type === "payable" : document.document_type === "receivable"); const bankRemaining = Number(line.amount) - Number(line.reconciled_amount); return <form action={reconcileBankStatementLineAction} className="grid gap-3 rounded-lg border border-border/70 bg-muted p-4 sm:grid-cols-2 xl:grid-cols-[1.1fr_1.5fr_120px_135px_150px_150px_auto]" key={line.id}><input name="bankStatementLineId" type="hidden" value={line.id} /><div><div className="text-xs font-semibold text-foreground">{line.counterparty_name ?? line.bank_account_name}</div><div className="mt-1 text-xs text-muted-foreground">{line.transaction_date} · 可核销 {money(bankRemaining)}</div></div><select className="h-10 rounded-md border border-border bg-white px-3 text-xs" name="financeDocumentId" required><option value="">选择{line.direction === "outflow" ? "应付" : "应收"}单据</option>{compatible.map((document) => <option key={document.id} value={document.id}>{document.document_no} · {document.counterparty_name} · 余额 {money(Number(document.total_amount) - Number(document.settled_amount))}</option>)}</select><input className="h-10 rounded-md border border-border px-3 text-xs" max={bankRemaining} min="0.01" name="amount" placeholder="核销金额" required step="0.01" type="number" /><input className="h-10 rounded-md border border-border px-3 text-xs" defaultValue={line.transaction_date} name="reconciledOn" required type="date" /><input className="h-10 rounded-md border border-border px-3 text-xs" defaultValue={line.direction === "outflow" ? "应付账款" : "银行存款"} name="debitAccount" placeholder="借方科目" required /><input className="h-10 rounded-md border border-border px-3 text-xs" defaultValue={line.direction === "outflow" ? "银行存款" : "应收账款"} name="creditAccount" placeholder="贷方科目" required /><button className="h-10 rounded-md bg-primary px-4 text-xs font-semibold text-white" type="submit">确认核销</button><input className="h-9 rounded-lg border border-border px-3 text-xs sm:col-span-2 xl:col-span-7" name="note" placeholder="核销备注（选填）" /></form>; })}{!unmatched.length && <div className="py-10 text-center text-xs text-muted-foreground">所有银行流水均已完成匹配</div>}</div></section>}
      </main>
    </WorkflowShell>
  );
}
