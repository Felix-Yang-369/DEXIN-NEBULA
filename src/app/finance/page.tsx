import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowUpRight,
  BanknoteArrowDown,
  CalendarClock,
  ChartNoAxesCombined,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  CircleDashed,
  FileClock,
  FileCheck2,
  FileSpreadsheet,
  LockKeyhole,
  Landmark,
  Plus,
  ReceiptText,
  Scale,
  WalletCards,
} from "lucide-react";
import { WorkflowShell } from "@/features/approvals/workflow-shell";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import {
  createFinanceDocument,
  createFinanceTransaction,
  createFinanceVoucher,
} from "@/features/finance/server-actions";
import { EditableFinanceDocumentGrid } from "@/features/finance/editable-document-grid";
import {
  agingBucket,
  outstandingAmount,
  type AgingBucket,
} from "@/features/finance/aging";
import type { FinanceDocumentRow } from "@/features/finance/types";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "财务中心",
  description: "德馨星云收支台账、费用管理与经营概览",
};

export const dynamic = "force-dynamic";

type FinanceTransaction = {
  id: string;
  transaction_no: string;
  transaction_type: "income" | "expense";
  category: string;
  counterparty: string | null;
  amount: number;
  occurred_on: string;
  payment_channel: "bank" | "wechat" | "alipay" | "cash" | "other";
  account_name: string | null;
  voucher_no: string | null;
  status: "draft" | "confirmed" | "void";
  note: string | null;
};

type FinanceVoucher = {
  id: string;
  voucher_no: string;
  voucher_date: string;
  voucher_type: "receipt" | "payment" | "transfer" | "general";
  summary: string;
  debit_account: string;
  credit_account: string;
  amount: number;
  attachment_count: number;
  status: "draft" | "posted" | "void";
};

type BankStatementSummary = {
  id: string;
  amount: number;
  reconciled_amount: number;
  status: "unmatched" | "partial" | "matched" | "ignored";
};

type FinanceInvoiceSummary = {
  id: string;
  status: "recorded" | "verified" | "void";
};

type LegalEntityOption = {
  id: string;
  customer_id: string;
  legal_name: string;
  short_name: string | null;
  is_default: boolean;
  customers:
    | { name: string; customer_no: string }
    | Array<{ name: string; customer_no: string }>
    | null;
};

function relatedOne<T>(value: T | T[] | null) {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

const currency = new Intl.NumberFormat("zh-CN", {
  style: "currency",
  currency: "CNY",
  minimumFractionDigits: 2,
});

const compactCurrency = new Intl.NumberFormat("zh-CN", {
  style: "currency",
  currency: "CNY",
  notation: "compact",
  maximumFractionDigits: 1,
});

const channelLabels: Record<FinanceTransaction["payment_channel"], string> = {
  bank: "银行转账",
  wechat: "微信支付",
  alipay: "支付宝",
  cash: "现金",
  other: "其他",
};

const statusLabels: Record<FinanceTransaction["status"], string> = {
  draft: "草稿",
  confirmed: "已确认",
  void: "已作废",
};

function roleLabel(roleCodes: string[]) {
  const labels: Record<string, string> = {
    admin: "系统管理员",
    chairman: "董事长",
    hr: "人事行政",
    finance: "财务",
    department_lead: "部门负责人",
    employee: "普通员工",
  };

  return roleCodes.map((code) => labels[code]).filter(Boolean).join(" · ");
}

function startOfCurrentMonth() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${now.getFullYear()}-${month}-01`;
}

function ledgerHref(book: string, month: string) {
  const params = new URLSearchParams();
  if (book !== "all") params.set("book", book);
  if (month !== "all") params.set("month", month);
  const query = params.toString();
  return `${query ? `/finance?${query}` : "/finance"}#documents`;
}

function monthLabel(month: string) {
  const [year, monthNumber] = month.split("-");
  return `${year}年${Number(monthNumber)}月`;
}

function today() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function MetricCard({
  label,
  value,
  note,
  icon,
  tone,
}: {
  label: string;
  value: string;
  note: string;
  icon: React.ReactNode;
  tone: string;
}) {
  return (
    <article className="rounded-md border border-border/75 bg-white p-5 ">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="mt-3 text-[25px] font-semibold tracking-[-0.04em]">
            {value}
          </div>
        </div>
        <div className={`grid size-10 place-items-center rounded-md ${tone}`}>
          {icon}
        </div>
      </div>
      <div className="mt-4 border-t border-border/70 pt-3 text-xs text-muted-foreground">
        {note}
      </div>
    </article>
  );
}

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{
    created?: string;
    documentCreated?: string;
    settled?: string;
    voucherCreated?: string;
    error?: string;
    type?: string;
    book?: string;
    month?: string;
  }>;
}) {
  const configured = isSupabaseConfigured();
  const employee = configured ? await requireCurrentEmployee() : null;
  const feedback = await searchParams;
  const roleCodes = employee?.roleCodes ?? ["finance"];
  const canView =
    !employee ||
    roleCodes.includes("finance") ||
    roleCodes.includes("chairman");
  const canManage = !employee || roleCodes.includes("finance");
  const typeFilter =
    feedback.type === "income" || feedback.type === "expense"
      ? feedback.type
      : "all";
  const bookFilter =
    feedback.book === "receivable" || feedback.book === "payable"
      ? feedback.book
      : "all";
  const monthFilter = /^\d{4}-(0[1-9]|1[0-2])$/.test(feedback.month ?? "")
    ? String(feedback.month)
    : "all";

  let transactions: FinanceTransaction[] = [];
  let documents: FinanceDocumentRow[] = [];
  let vouchers: FinanceVoucher[] = [];
  let bankStatementLines: BankStatementSummary[] = [];
  let financeInvoices: FinanceInvoiceSummary[] = [];
  let legalEntityOptions: LegalEntityOption[] = [];
  let dataAvailable = !configured;

  if (employee && canView) {
    const supabase = await createClient();
    let query = supabase
      .from("finance_transactions")
      .select(
        "id, transaction_no, transaction_type, category, counterparty, amount, occurred_on, payment_channel, account_name, voucher_no, status, note",
      )
      .order("occurred_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(100);

    if (typeFilter !== "all") {
      query = query.eq("transaction_type", typeFilter);
    }

    const documentQuery = supabase
      .from("finance_documents")
      .select(
        "id, document_no, document_type, counterparty_name, source_type, source_no, issue_date, due_date, total_amount, settled_amount, status, invoice_no, summary, note, updated_at",
      )
      .order("issue_date", { ascending: false })
      .order("due_date", { ascending: true })
      .limit(100);

    const [
      transactionResult,
      documentResult,
      voucherResult,
      bankStatementResult,
      invoiceResult,
      legalEntityResult,
    ] = await Promise.all([
        query,
        documentQuery,
        supabase
          .from("finance_vouchers")
          .select(
            "id, voucher_no, voucher_date, voucher_type, summary, debit_account, credit_account, amount, attachment_count, status",
          )
          .order("voucher_date", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(30),
        supabase
          .from("bank_statement_lines")
          .select("id, amount, reconciled_amount, status")
          .order("transaction_date", { ascending: false })
          .limit(100),
        supabase
          .from("finance_invoices")
          .select("id, status")
          .order("issued_on", { ascending: false })
          .limit(100),
        supabase
          .from("customer_legal_entities")
          .select(
            "id, customer_id, legal_name, short_name, is_default, customers(name, customer_no)",
          )
          .eq("status", "active")
          .order("is_default", { ascending: false })
          .order("legal_name", { ascending: true }),
      ]);

    dataAvailable =
      !transactionResult.error &&
      !documentResult.error &&
      !voucherResult.error;
    transactions = (transactionResult.data ?? []) as FinanceTransaction[];
    documents = (documentResult.data ?? []) as FinanceDocumentRow[];
    vouchers = (voucherResult.data ?? []) as FinanceVoucher[];
    bankStatementLines = (bankStatementResult.data ?? []) as BankStatementSummary[];
    financeInvoices = (invoiceResult.data ?? []) as FinanceInvoiceSummary[];
    legalEntityOptions = (legalEntityResult.data ?? []) as LegalEntityOption[];
  }

  const currentMonthRows = transactions.filter(
    (row) => row.occurred_on >= startOfCurrentMonth() && row.status !== "void",
  );
  const monthlyIncome = currentMonthRows
    .filter((row) => row.transaction_type === "income")
    .reduce((total, row) => total + Number(row.amount), 0);
  const monthlyExpense = currentMonthRows
    .filter((row) => row.transaction_type === "expense")
    .reduce((total, row) => total + Number(row.amount), 0);
  const monthlyNet = monthlyIncome - monthlyExpense;
  const activeDocuments = documents.filter(
    (row) => row.status === "open" || row.status === "partial",
  );
  const receivableOutstanding = activeDocuments
    .filter((row) => row.document_type === "receivable")
    .reduce(
      (total, row) =>
        total + outstandingAmount(row.total_amount, row.settled_amount),
      0,
    );
  const payableOutstanding = activeDocuments
    .filter((row) => row.document_type === "payable")
    .reduce(
      (total, row) =>
        total + outstandingAmount(row.total_amount, row.settled_amount),
      0,
    );
  const overdueReceivable = activeDocuments
    .filter(
      (row) =>
        row.document_type === "receivable" &&
        agingBucket(row.due_date, today()) !== "current",
    )
    .reduce(
      (total, row) =>
        total + outstandingAmount(row.total_amount, row.settled_amount),
      0,
    );
  const agingOrder: AgingBucket[] = [
    "current",
    "1-30",
    "31-60",
    "61-90",
    "90+",
  ];
  const agingTotals = Object.fromEntries(
    agingOrder.map((bucket) => [
      bucket,
      activeDocuments.reduce(
        (sum, row) =>
          agingBucket(row.due_date, today()) === bucket
            ? sum + outstandingAmount(row.total_amount, row.settled_amount)
            : sum,
        0,
      ),
    ]),
  ) as Record<AgingBucket, number>;
  const maxAging = Math.max(...Object.values(agingTotals), 1);
  const monthStats = Array.from(
    documents.reduce((result, row) => {
      const month = row.issue_date.slice(0, 7);
      const current = result.get(month) ?? {
        month,
        count: 0,
        receivable: 0,
        payable: 0,
      };
      current.count += 1;
      const outstanding = outstandingAmount(
        row.total_amount,
        row.settled_amount,
      );
      if (row.document_type === "receivable") {
        current.receivable += outstanding;
      } else {
        current.payable += outstanding;
      }
      result.set(month, current);
      return result;
    }, new Map<string, { month: string; count: number; receivable: number; payable: number }>())
      .values(),
  ).sort((left, right) => right.month.localeCompare(left.month));
  const displayedDocuments = documents.filter(
    (row) =>
      (bookFilter === "all" || row.document_type === bookFilter) &&
      (monthFilter === "all" || row.issue_date.startsWith(monthFilter)),
  );
  const overdueReceivableRows = activeDocuments.filter(
    (row) =>
      row.document_type === "receivable" &&
      agingBucket(row.due_date, today()) !== "current",
  );
  const overduePayableRows = activeDocuments.filter(
    (row) =>
      row.document_type === "payable" &&
      agingBucket(row.due_date, today()) !== "current",
  );
  const unmatchedBankLines = bankStatementLines.filter(
    (row) => !["matched", "ignored"].includes(row.status),
  );
  const unmatchedBankAmount = unmatchedBankLines.reduce(
    (sum, row) =>
      sum + Math.max(0, Number(row.amount) - Number(row.reconciled_amount)),
    0,
  );
  const uninvoicedDocumentCount = activeDocuments.filter(
    (row) => !row.invoice_no,
  ).length;
  const draftVoucherCount = vouchers.filter(
    (row) => row.status === "draft",
  ).length;
  const unverifiedInvoiceCount = financeInvoices.filter(
    (row) => row.status === "recorded",
  ).length;
  const financeTasks = [
    {
      label: "逾期应收催办",
      value: `${overdueReceivableRows.length} 笔`,
      detail: compactCurrency.format(overdueReceivable),
      href: "/finance?book=receivable#documents",
      tone: "border-border bg-muted text-foreground",
      icon: <CircleAlert className="size-4" />,
    },
    {
      label: "到期应付安排",
      value: `${overduePayableRows.length} 笔`,
      detail: "核对付款计划与资金账户",
      href: "/finance?book=payable#documents",
      tone: "border-border bg-muted text-foreground",
      icon: <CalendarClock className="size-4" />,
    },
    {
      label: "银行流水待匹配",
      value: `${unmatchedBankLines.length} 笔`,
      detail: compactCurrency.format(unmatchedBankAmount),
      href: "/finance/bank-reconciliation#reconcile",
      tone: "border-border bg-muted text-foreground",
      icon: <Landmark className="size-4" />,
    },
    {
      label: "发票待核验",
      value: `${unverifiedInvoiceCount} 张`,
      detail: "完成票据台账复核",
      href: "/finance/invoices",
      tone: "border-border bg-muted text-foreground",
      icon: <ReceiptText className="size-4" />,
    },
  ];

  return (
    <WorkflowShell
      activeItem="财务总览"
      breadcrumb="财务管理 / 财务总览"
      currentUser={
        employee
          ? {
              name: employee.name,
              roleLabel: roleLabel(employee.roleCodes) || "内部员工",
            }
          : undefined
      }
    >
      <main className="mx-auto max-w-[1440px] p-4 sm:p-6 xl:p-8">
        <div className="mb-4 flex justify-end"><Link className="rounded-md bg-primary px-4 py-2 text-xs text-white" href="/finance/automation">进入业财自动化</Link></div>
        <section className="ui-page-header">
          <div className="absolute -right-16 -top-28 size-80 rounded-full border border-white/8" />
          <div className="absolute right-24 top-14 size-28 rounded-full border border-white/8" />
          <ChartNoAxesCombined className="pointer-events-none absolute right-12 top-1/2 hidden size-40 -translate-y-1/2 text-white/[0.055] sm:block" />
          <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <div className="text-xs font-medium tracking-[0.12em] text-muted-foreground">
                FMS · FINANCE MANAGEMENT SYSTEM
              </div>
              <h1 className="mt-3 text-2xl font-semibold tracking-[-0.035em] sm:text-[30px]">
                财务管理中心
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/55">
                统一管理应收应付、收付款核销、账龄风险与记账凭证，让每一笔业务都有来源、去向与财务依据。
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
              {canView ? (
                <Link
                  className="inline-flex h-10 items-center gap-2 rounded-md border border-white/18 bg-white/8 px-4 text-xs font-medium text-white transition-colors hover:bg-white/14"
                  href="/finance/accounting"
                >
                  <Scale className="size-4" />
                  会计核算
                </Link>
              ) : null}
              {canView ? (
                <Link
                  className="inline-flex h-10 items-center gap-2 rounded-md border border-white/18 bg-white/8 px-4 text-xs font-medium text-white transition-colors hover:bg-white/14"
                  href="/finance/receivables"
                >
                  <FileSpreadsheet className="size-4" />
                  应收汇总账
                </Link>
              ) : null}
              {canManage ? (
                <a
                  className="inline-flex h-10 items-center gap-2 rounded-md bg-white px-4 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                  href="#documents"
                >
                  <Plus className="size-4" />
                  新建往来单据
                </a>
              ) : (
                <div className="inline-flex h-10 items-center gap-2 rounded-md border border-white/12 bg-white/8 px-4 text-xs text-white/66">
                  <LockKeyhole className="size-4" />
                  董事长经营只读视图
                </div>
              )}
            </div>
          </div>
        </section>

        {!canView ? (
          <section className="mt-5 rounded-md border border-border/75 bg-white px-6 py-16 text-center">
            <LockKeyhole className="mx-auto size-10 text-muted-foreground/60" />
            <h2 className="mt-4 text-base font-semibold">暂无财务数据访问权限</h2>
            <p className="mt-2 text-xs text-muted-foreground">
              财务中心仅向财务角色和董事长开放，系统管理员默认不能读取敏感财务数据。
            </p>
            <Link
              className="mt-5 inline-flex h-9 items-center rounded-md bg-primary px-4 text-xs text-primary-foreground"
              href="/dashboard"
            >
              返回工作台
            </Link>
          </section>
        ) : (
          <>
            {!dataAvailable && configured && (
              <div className="mt-5 rounded-lg border border-border bg-muted px-4 py-3 text-xs text-foreground">
                财务数据表尚未初始化，请执行最新 Supabase 数据库迁移。
              </div>
            )}

            {feedback.created && (
              <div className="mt-5 rounded-lg border border-border bg-muted px-4 py-3 text-xs text-foreground">
                已登记财务流水：{feedback.created}
              </div>
            )}
            {feedback.documentCreated && (
              <div className="mt-5 rounded-lg border border-border bg-muted px-4 py-3 text-xs text-foreground">
                已创建往来单据：{feedback.documentCreated}
              </div>
            )}
            {feedback.settled && (
              <div className="mt-5 rounded-lg border border-border bg-muted px-4 py-3 text-xs text-foreground">
                核销完成：{feedback.settled}，现金流水与记账凭证已同步生成。
              </div>
            )}
            {feedback.voucherCreated && (
              <div className="mt-5 rounded-lg border border-border bg-muted px-4 py-3 text-xs text-foreground">
                已登记凭证：{feedback.voucherCreated}
              </div>
            )}
            {feedback.error && (
              <div className="mt-5 rounded-lg border border-border bg-muted px-4 py-3 text-xs text-foreground">
                {feedback.error}
              </div>
            )}

            <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(330px,.55fr)]">
              <article className="overflow-hidden rounded-md border border-border/75 bg-white">
                <div className="flex flex-col gap-3 border-b border-border/70 px-5 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-6">
                  <div>
                    <div className="text-xs font-semibold tracking-[0.16em] text-foreground">
                      TODAY · FINANCE DESK
                    </div>
                    <h2 className="mt-2 text-base font-semibold">财务待办工作台</h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      按风险和处理顺序汇总真实业务数据，点击即可进入对应台账。
                    </p>
                  </div>
                  <span className="w-fit rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-foreground">
                    {financeTasks.reduce(
                      (sum, item) => sum + Number.parseInt(item.value, 10),
                      0,
                    )}{" "}
                    项待处理
                  </span>
                </div>
                <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
                  {financeTasks.map((task) => (
                    <Link
                      className={`group flex min-h-28 items-start gap-3 rounded-md border p-4 transition   ${task.tone}`}
                      href={task.href}
                      key={task.label}
                    >
                      <span className="grid size-9 shrink-0 place-items-center rounded-md bg-white/80 ">
                        {task.icon}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-medium opacity-80">
                          {task.label}
                        </span>
                        <span className="mt-2 block text-xl font-semibold tracking-[-0.03em]">
                          {task.value}
                        </span>
                        <span className="mt-1 block truncate text-xs opacity-65">
                          {task.detail}
                        </span>
                      </span>
                      <ChevronRight className="mt-2 size-4 shrink-0 opacity-35 transition group-hover:translate-x-0.5 group-hover:opacity-70" />
                    </Link>
                  ))}
                </div>
              </article>

              <article className="rounded-md border border-border bg-card p-5 text-foreground sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-base font-semibold">
                      {monthLabel(startOfCurrentMonth().slice(0, 7))}月结准备
                    </h2>
                  </div>
                  <FileClock className="size-5 text-primary" />
                </div>
                <div className="mt-5 space-y-2.5">
                  {[
                    {
                      label: "往来单据发票关联",
                      pending: uninvoicedDocumentCount,
                    },
                    {
                      label: "银行流水核销",
                      pending: unmatchedBankLines.length,
                    },
                    { label: "凭证过账", pending: draftVoucherCount },
                    { label: "发票核验", pending: unverifiedInvoiceCount },
                  ].map((step) => {
                    const ready = step.pending === 0;
                    return (
                      <div
                        className="flex items-center gap-3 border-b border-border px-1 py-3 last:border-b-0"
                        key={step.label}
                      >
                        {ready ? (
                          <CheckCircle2 className="size-4 shrink-0 text-muted-foreground" />
                        ) : (
                          <CircleDashed className="size-4 shrink-0 text-muted-foreground" />
                        )}
                        <span className="min-w-0 flex-1 text-xs text-foreground">
                          {step.label}
                        </span>
                        <span
                          className={`text-xs font-medium ${ready ? "text-muted-foreground" : "text-muted-foreground"}`}
                        >
                          {ready ? "已就绪" : `${step.pending} 项`}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-4 text-xs leading-5 text-muted-foreground">
                  当前为月结前检查清单，不执行正式会计结账；总账、法定报表和反结账将在会计科目体系完成后接入。
                </p>
              </article>
            </section>

            <section className="mt-5 rounded-md border border-border/75 bg-white p-4 sm:p-5">
              <div className="mb-4 flex items-end justify-between gap-4">
                <div>
                  <h2 className="text-sm font-semibold">财务业务导航</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    按财务工作流组织应收、应付、资金、核销与凭证
                  </p>
                </div>
                <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground">
                  FMS
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  {
                    href: "/finance/receivables",
                    label: "应收汇总账",
                    note: "期间与客户汇总",
                    icon: <FileSpreadsheet className="size-4" />,
                  },
                  {
                    href: "/finance?book=receivable#documents",
                    label: "应收明细",
                    note: "单据与余额",
                    icon: <ArrowDownLeft className="size-4" />,
                  },
                  {
                    href: "/finance?book=payable#documents",
                    label: "应付明细",
                    note: "付款与供应商",
                    icon: <ArrowUpRight className="size-4" />,
                  },
                  {
                    href: "/finance#aging",
                    label: "账龄分析",
                    note: "逾期风险分层",
                    icon: <CalendarClock className="size-4" />,
                  },
                  {
                    href: "/finance#entry",
                    label: "收支登记",
                    note: "银行与现金流水",
                    icon: <WalletCards className="size-4" />,
                  },
                  {
                    href: "/finance#vouchers",
                    label: "记账凭证",
                    note: "核销自动联动",
                    icon: <FileCheck2 className="size-4" />,
                  },
                  {
                    href: "/finance/bank-reconciliation",
                    label: "银行对账",
                    note: "流水匹配与核销",
                    icon: <Landmark className="size-4" />,
                  },
                  {
                    href: "/finance/invoices",
                    label: "发票台账",
                    note: "登记、关联与核验",
                    icon: <ReceiptText className="size-4" />,
                  },
                  {
                    href: "/finance/cash-documents",
                    label: "收付款单",
                    note: "制单、审批与多单核销",
                    icon: <BanknoteArrowDown className="size-4" />,
                  },
                ].map((item) => (
                  <Link
                    className="group rounded-lg border border-border bg-muted p-3 transition  hover:border-border hover:bg-muted"
                    href={item.href}
                    key={item.label}
                  >
                    <span className="grid size-8 place-items-center rounded-lg bg-muted text-foreground">
                      {item.icon}
                    </span>
                    <span className="mt-3 block text-xs font-medium text-foreground">
                      {item.label}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {item.note}
                    </span>
                  </Link>
                ))}
              </div>
            </section>

            <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                icon={<ArrowDownLeft className="size-5" />}
                label="应收余额"
                note={`${activeDocuments.filter((row) => row.document_type === "receivable").length} 笔待收款单据`}
                tone="bg-muted text-foreground"
                value={compactCurrency.format(receivableOutstanding)}
              />
              <MetricCard
                icon={<ArrowUpRight className="size-5" />}
                label="应付余额"
                note={`${activeDocuments.filter((row) => row.document_type === "payable").length} 笔待付款单据`}
                tone="bg-muted text-foreground"
                value={compactCurrency.format(payableOutstanding)}
              />
              <MetricCard
                icon={<CalendarClock className="size-5" />}
                label="逾期应收"
                note="已过到期日且尚未全部核销"
                tone="bg-muted text-foreground"
                value={compactCurrency.format(overdueReceivable)}
              />
              <MetricCard
                icon={<FileCheck2 className="size-5" />}
                label="待记账凭证"
                note={`${vouchers.filter((row) => row.status === "posted").length} 张已记账凭证`}
                tone="bg-muted text-foreground"
                value={`${vouchers.filter((row) => row.status === "draft").length} 张`}
              />
            </section>

            <section className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
              <article
                className="rounded-md border border-border/75 bg-white p-5 sm:p-6"
                id="aging"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-semibold">账龄结构</h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      按未核销余额与到期日自动归档
                    </p>
                  </div>
                  <Scale className="size-5 text-primary/65" />
                </div>
                <div className="mt-6 grid grid-cols-5 items-end gap-3">
                  {agingOrder.map((bucket) => {
                    const height = Math.max(
                      8,
                      (agingTotals[bucket] / maxAging) * 88,
                    );
                    const label =
                      bucket === "current"
                        ? "未到期"
                        : bucket === "90+"
                          ? "90天+"
                          : `${bucket}天`;
                    return (
                      <div className="text-center" key={bucket}>
                        <div className="text-xs font-medium">
                          {compactCurrency.format(agingTotals[bucket])}
                        </div>
                        <div className="mt-2 flex h-24 items-end rounded-lg bg-muted px-2">
                          <div
                            className={`w-full rounded-t-md ${
                              bucket === "current"
                                ? "bg-muted"
                                : bucket === "90+"
                                  ? "bg-muted"
                                  : "bg-muted"
                            }`}
                            style={{ height }}
                          />
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground">
                          {label}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </article>
              <article className="rounded-md border border-border/75 bg-muted p-5 sm:p-6">
                <div className="flex items-center gap-3">
                  <div className="grid size-10 place-items-center rounded-md bg-white text-primary ">
                    <Landmark className="size-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold">本月资金概览</h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      来自已确认现金收支
                    </p>
                  </div>
                </div>
                <dl className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-md bg-white p-3">
                    <dt className="text-xs text-muted-foreground">本月收入</dt>
                    <dd className="mt-1 text-sm font-semibold text-foreground">
                      {compactCurrency.format(monthlyIncome)}
                    </dd>
                  </div>
                  <div className="rounded-md bg-white p-3">
                    <dt className="text-xs text-muted-foreground">本月支出</dt>
                    <dd className="mt-1 text-sm font-semibold text-foreground">
                      {compactCurrency.format(monthlyExpense)}
                    </dd>
                  </div>
                  <div className="col-span-2 rounded-md bg-white p-3">
                    <dt className="text-xs text-muted-foreground">本月净额</dt>
                    <dd className="mt-1 text-lg font-semibold">
                      {currency.format(monthlyNet)}
                    </dd>
                  </div>
                </dl>
              </article>
            </section>

            <div
              className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(360px,.5fr)]"
              id="documents"
            >
              <section className="overflow-hidden rounded-md border border-border/75 bg-white">
                <div className="flex flex-col gap-4 border-b border-border/70 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <div>
                    <h2 className="text-base font-semibold">应收应付台账</h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      按开单月份分类；类 Excel 批量编辑，核销后自动更新余额、现金流水和凭证
                    </p>
                  </div>
                  <div className="flex rounded-md bg-muted p-1 text-xs">
                    {[
                      ["all", "全部"],
                      ["receivable", "应收"],
                      ["payable", "应付"],
                    ].map(([value, label]) => (
                      <Link
                        className={`rounded-lg px-3 py-2 ${
                          bookFilter === value
                            ? "bg-white font-medium text-primary "
                            : "text-muted-foreground"
                        }`}
                        href={ledgerHref(value, monthFilter)}
                        key={value}
                      >
                        {label}
                      </Link>
                    ))}
                  </div>
                </div>
                <div className="border-b border-border bg-muted px-5 py-3 sm:px-6">
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    <Link
                      className={`shrink-0 rounded-md border px-3 py-2 text-xs transition ${
                        monthFilter === "all"
                          ? "border-border bg-muted font-medium text-foreground"
                          : "border-border bg-white text-muted-foreground hover:border-border"
                      }`}
                      href={ledgerHref(bookFilter, "all")}
                    >
                      全部月份 · {documents.length} 笔
                    </Link>
                    {monthStats.map((stat) => (
                      <Link
                        className={`shrink-0 rounded-md border px-3 py-2 transition ${
                          monthFilter === stat.month
                            ? "border-border bg-muted text-foreground"
                            : "border-border bg-white text-muted-foreground hover:border-border"
                        }`}
                        href={ledgerHref(bookFilter, stat.month)}
                        key={stat.month}
                      >
                        <span className="block text-xs font-medium">
                          {monthLabel(stat.month)} · {stat.count} 笔
                        </span>
                        <span className="mt-1 block text-xs opacity-75">
                          应收 {compactCurrency.format(stat.receivable)} · 应付{" "}
                          {compactCurrency.format(stat.payable)}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
                {displayedDocuments.length ? (
                  <EditableFinanceDocumentGrid
                    canManage={canManage}
                    currentDate={today()}
                    key={`${bookFilter}:${monthFilter}:${displayedDocuments
                      .map((row) => row.updated_at)
                      .join("|")}`}
                    rows={displayedDocuments}
                  />
                ) : (
                  <div className="px-6 py-14 text-center text-xs text-muted-foreground">
                    {monthFilter === "all"
                      ? "暂无应收应付单据"
                      : `${monthLabel(monthFilter)}暂无${bookFilter === "receivable" ? "应收" : bookFilter === "payable" ? "应付" : "应收应付"}单据`}
                  </div>
                )}
              </section>

              <section className="rounded-md border border-border/75 bg-white p-5 sm:p-6">
                <h2 className="text-base font-semibold">新建往来单据</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  业务发生时先建立债权或债务
                </p>
                {canManage ? (
                  <form action={createFinanceDocument} className="mt-5 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <select className="h-10 rounded-md border border-border bg-white px-3 text-xs" name="documentType">
                        <option value="receivable">应收款</option>
                        <option value="payable">应付款</option>
                      </select>
                      <select className="h-10 rounded-md border border-border bg-white px-3 text-xs" name="sourceType">
                        <option value="manual">手工登记</option>
                        <option value="order">销售订单</option>
                        <option value="purchase">采购订单</option>
                        <option value="expense">费用申请</option>
                        <option value="other">其他</option>
                      </select>
                    </div>
                    <select className="h-10 w-full rounded-md border border-border bg-white px-3 text-xs" defaultValue="" name="legalEntityId">
                      <option value="">选择客户法律实体（客户往来必选）</option>
                      {legalEntityOptions.map((entity) => {
                        const customer = relatedOne(entity.customers);
                        return (
                          <option key={entity.id} value={entity.id}>
                            {customer?.name ?? "未关联客户"}｜{entity.legal_name}
                            {entity.is_default ? "（默认）" : ""}
                          </option>
                        );
                      })}
                    </select>
                    <input className="h-10 w-full rounded-md border border-border bg-white px-3 text-xs" maxLength={100} name="counterpartyName" placeholder="非客户往来单位（如供应商，可手工填写）" />
                    <p className="text-xs leading-4 text-muted-foreground">
                      选择法律实体后，系统会自动带入其工商全称并归属对应客户；供应商等非客户往来可直接填写名称。
                    </p>
                    <input className="h-10 w-full rounded-md border border-border bg-white px-3 text-xs" maxLength={160} name="summary" placeholder="业务摘要" required />
                    <div className="grid grid-cols-2 gap-3">
                      <input className="h-10 rounded-md border border-border bg-white px-3 text-xs" defaultValue={today()} name="issueDate" required type="date" />
                      <input className="h-10 rounded-md border border-border bg-white px-3 text-xs" defaultValue={today()} name="dueDate" required type="date" />
                    </div>
                    <input className="h-10 w-full rounded-md border border-border bg-white px-3 text-xs" min="0.01" name="totalAmount" placeholder="单据金额" required step="0.01" type="number" />
                    <div className="grid grid-cols-2 gap-3">
                      <input className="h-10 rounded-md border border-border bg-white px-3 text-xs" name="sourceNo" placeholder="来源单号" />
                      <input className="h-10 rounded-md border border-border bg-white px-3 text-xs" name="invoiceNo" placeholder="发票号码" />
                    </div>
                    <textarea className="min-h-16 w-full rounded-md border border-border bg-white px-3 py-2 text-xs" name="note" placeholder="备注（选填）" />
                    <button className="h-10 w-full rounded-md bg-primary px-4 text-xs font-medium text-primary-foreground" type="submit">
                      创建应收应付单
                    </button>
                  </form>
                ) : (
                  <p className="mt-5 rounded-md bg-muted p-4 text-xs text-muted-foreground">
                    当前为董事长只读视图。
                  </p>
                )}
              </section>
            </div>

            <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,.55fr)]">
              <section className="overflow-hidden rounded-md border border-border/75 bg-white">
                <div className="flex flex-col gap-4 border-b border-border/70 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <div>
                    <h2 className="text-base font-semibold tracking-[-0.02em]">
                      收支台账
                    </h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      最近 100 笔业务流水，按业务日期倒序排列
                    </p>
                  </div>
                  <div className="flex rounded-md bg-muted p-1 text-xs">
                    {[
                      ["all", "全部"],
                      ["income", "收入"],
                      ["expense", "支出"],
                    ].map(([value, label]) => (
                      <Link
                        className={`rounded-lg px-3 py-2 ${
                          typeFilter === value
                            ? "bg-white font-medium text-primary "
                            : "text-muted-foreground"
                        }`}
                        href={value === "all" ? "/finance" : `/finance?type=${value}`}
                        key={value}
                      >
                        {label}
                      </Link>
                    ))}
                  </div>
                </div>

                {transactions.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-left">
                      <thead className="bg-muted text-xs text-muted-foreground">
                        <tr>
                          <th className="px-6 py-3 font-medium">业务日期 / 流水号</th>
                          <th className="px-4 py-3 font-medium">分类与往来方</th>
                          <th className="px-4 py-3 font-medium">账户</th>
                          <th className="px-4 py-3 font-medium">状态</th>
                          <th className="px-6 py-3 text-right font-medium">金额</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/65">
                        {transactions.map((row) => (
                          <tr className="text-xs hover:bg-muted" key={row.id}>
                            <td className="px-6 py-4">
                              <div className="font-medium">{row.occurred_on}</div>
                              <div className="mt-1 font-mono text-xs text-muted-foreground">
                                {row.transaction_no}
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <div className="font-medium">{row.category}</div>
                              <div className="mt-1 text-xs text-muted-foreground">
                                {row.counterparty || "未填写往来方"}
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <div>{channelLabels[row.payment_channel]}</div>
                              <div className="mt-1 text-xs text-muted-foreground">
                                {row.account_name || "默认账户"}
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <span
                                className={`rounded-full px-2.5 py-1 text-xs ${
                                  row.status === "confirmed"
                                    ? "bg-muted text-foreground"
                                    : row.status === "void"
                                      ? "bg-muted text-foreground"
                                      : "bg-muted text-foreground"
                                }`}
                              >
                                {statusLabels[row.status]}
                              </span>
                            </td>
                            <td
                              className={`px-6 py-4 text-right font-semibold ${
                                row.transaction_type === "income"
                                  ? "text-foreground"
                                  : "text-foreground"
                              }`}
                            >
                              {row.transaction_type === "income" ? "+" : "-"}
                              {currency.format(Number(row.amount))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="px-6 py-16 text-center">
                    <ReceiptText className="mx-auto size-10 text-muted-foreground/45" />
                    <h3 className="mt-4 text-sm font-medium">还没有财务流水</h3>
                    <p className="mt-2 text-xs text-muted-foreground">
                      财务人员登记第一笔收支后，经营数据会自动汇总到这里。
                    </p>
                  </div>
                )}
              </section>

              <div className="space-y-5">
                <section
                  className="rounded-md border border-border/75 bg-white p-5 sm:p-6"
                  id="entry"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-base font-semibold tracking-[-0.02em]">
                        登记收支
                      </h2>
                      <p className="mt-1 text-xs text-muted-foreground">
                        仅财务角色可写入正式台账
                      </p>
                    </div>
                    <WalletCards className="size-5 text-primary/65" />
                  </div>

                  {canManage ? (
                    <form action={createFinanceTransaction} className="mt-5 space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <label className="text-xs text-muted-foreground">
                          收支类型
                          <select
                            className="mt-1.5 h-10 w-full rounded-md border border-border bg-white px-3 text-xs text-foreground outline-none focus:border-primary/40"
                            defaultValue="expense"
                            name="transactionType"
                          >
                            <option value="income">收入</option>
                            <option value="expense">支出</option>
                          </select>
                        </label>
                        <label className="text-xs text-muted-foreground">
                          单据状态
                          <select
                            className="mt-1.5 h-10 w-full rounded-md border border-border bg-white px-3 text-xs text-foreground outline-none focus:border-primary/40"
                            defaultValue="confirmed"
                            name="status"
                          >
                            <option value="confirmed">已确认</option>
                            <option value="draft">草稿</option>
                          </select>
                        </label>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <label className="text-xs text-muted-foreground">
                          分类
                          <input
                            className="mt-1.5 h-10 w-full rounded-md border border-border bg-white px-3 text-xs text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-primary/40"
                            maxLength={40}
                            name="category"
                            placeholder="如：货款、物流费"
                            required
                          />
                        </label>
                        <label className="text-xs text-muted-foreground">
                          金额
                          <input
                            className="mt-1.5 h-10 w-full rounded-md border border-border bg-white px-3 text-xs text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-primary/40"
                            min="0.01"
                            name="amount"
                            placeholder="0.00"
                            required
                            step="0.01"
                            type="number"
                          />
                        </label>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <label className="text-xs text-muted-foreground">
                          业务日期
                          <input
                            className="mt-1.5 h-10 w-full rounded-md border border-border bg-white px-3 text-xs text-foreground outline-none focus:border-primary/40"
                            defaultValue={today()}
                            name="occurredOn"
                            required
                            type="date"
                          />
                        </label>
                        <label className="text-xs text-muted-foreground">
                          收付款方式
                          <select
                            className="mt-1.5 h-10 w-full rounded-md border border-border bg-white px-3 text-xs text-foreground outline-none focus:border-primary/40"
                            defaultValue="bank"
                            name="paymentChannel"
                          >
                            <option value="bank">银行转账</option>
                            <option value="wechat">微信支付</option>
                            <option value="alipay">支付宝</option>
                            <option value="cash">现金</option>
                            <option value="other">其他</option>
                          </select>
                        </label>
                      </div>
                      <label className="block text-xs text-muted-foreground">
                        往来方
                        <input
                          className="mt-1.5 h-10 w-full rounded-md border border-border bg-white px-3 text-xs text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-primary/40"
                          maxLength={100}
                          name="counterparty"
                          placeholder="客户或供应商名称"
                        />
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <label className="text-xs text-muted-foreground">
                          收付款账户
                          <input
                            className="mt-1.5 h-10 w-full rounded-md border border-border bg-white px-3 text-xs text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-primary/40"
                            maxLength={80}
                            name="accountName"
                            placeholder="公司基本户"
                          />
                        </label>
                        <label className="text-xs text-muted-foreground">
                          凭证号
                          <input
                            className="mt-1.5 h-10 w-full rounded-md border border-border bg-white px-3 text-xs text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-primary/40"
                            maxLength={50}
                            name="voucherNo"
                            placeholder="选填"
                          />
                        </label>
                      </div>
                      <label className="block text-xs text-muted-foreground">
                        摘要备注
                        <textarea
                          className="mt-1.5 min-h-20 w-full resize-y rounded-md border border-border bg-white px-3 py-2.5 text-xs text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-primary/40"
                          maxLength={300}
                          name="note"
                          placeholder="填写业务背景或付款说明"
                        />
                      </label>
                      <button
                        className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/92"
                        type="submit"
                      >
                        <BanknoteArrowDown className="size-4" />
                        保存到财务台账
                      </button>
                    </form>
                  ) : (
                    <div className="mt-5 rounded-lg border border-dashed border-border bg-muted px-4 py-8 text-center">
                      <LockKeyhole className="mx-auto size-7 text-muted-foreground/55" />
                      <div className="mt-3 text-xs font-medium">当前为只读经营视图</div>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        收支登记、编辑与作废操作由财务角色负责。
                      </p>
                    </div>
                  )}
                </section>

                <section
                  className="rounded-md border border-border/75 bg-muted p-5 sm:p-6"
                  id="vouchers"
                >
                  <div className="flex items-center gap-3">
                    <div className="grid size-10 place-items-center rounded-md bg-white text-primary ">
                      <FileClock className="size-5" />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold">记账凭证</h2>
                      <p className="mt-1 text-xs text-muted-foreground">
                        核销自动生成，也可手工登记
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    {vouchers.slice(0, 4).map((voucher) => (
                      <div className="rounded-md bg-white p-3" key={voucher.id}>
                        <div className="flex items-center justify-between gap-3">
                          <span className="truncate text-xs font-medium">
                            {voucher.summary}
                          </span>
                          <span className="shrink-0 text-xs font-semibold">
                            {currency.format(Number(voucher.amount))}
                          </span>
                        </div>
                        <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                          <span>{voucher.voucher_no}</span>
                          <span>
                            {voucher.status === "posted" ? "已记账" : "草稿"} ·
                            附件 {voucher.attachment_count}
                          </span>
                        </div>
                      </div>
                    ))}
                    {!vouchers.length && (
                      <div className="rounded-md bg-white p-4 text-center text-xs text-muted-foreground">
                        暂无凭证
                      </div>
                    )}
                  </div>
                  {canManage && (
                    <details className="mt-4 rounded-md bg-white p-3">
                      <summary className="cursor-pointer text-xs font-medium text-primary">
                        手工登记凭证
                      </summary>
                      <form action={createFinanceVoucher} className="mt-3 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <input className="h-9 rounded-lg border border-border px-3 text-xs" defaultValue={today()} name="voucherDate" required type="date" />
                          <select className="h-9 rounded-lg border border-border px-3 text-xs" name="voucherType">
                            <option value="general">转账凭证</option>
                            <option value="receipt">收款凭证</option>
                            <option value="payment">付款凭证</option>
                            <option value="transfer">内部转账</option>
                          </select>
                        </div>
                        <input className="h-9 w-full rounded-lg border border-border px-3 text-xs" name="summary" placeholder="凭证摘要" required />
                        <div className="grid grid-cols-2 gap-2">
                          <input className="h-9 rounded-lg border border-border px-3 text-xs" name="debitAccount" placeholder="借方科目" required />
                          <input className="h-9 rounded-lg border border-border px-3 text-xs" name="creditAccount" placeholder="贷方科目" required />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <input className="h-9 rounded-lg border border-border px-3 text-xs" min="0.01" name="amount" placeholder="金额" required step="0.01" type="number" />
                          <input className="h-9 rounded-lg border border-border px-3 text-xs" min="0" name="attachmentCount" placeholder="附件张数" type="number" />
                        </div>
                        <select className="h-9 w-full rounded-lg border border-border px-3 text-xs" name="status">
                          <option value="posted">直接记账</option>
                          <option value="draft">保存草稿</option>
                        </select>
                        <button className="h-9 w-full rounded-lg bg-primary text-xs text-primary-foreground" type="submit">
                          保存凭证
                        </button>
                      </form>
                    </details>
                  )}
                </section>
              </div>
            </div>
          </>
        )}
      </main>
    </WorkflowShell>
  );
}
