import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Download,
  FileCheck2,
  Landmark,
  Plus,
  ReceiptText,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { WorkflowShell } from "@/features/approvals/workflow-shell";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import {
  createCashDocumentAction,
  reverseCashDocumentAction,
  transitionCashDocumentAction,
} from "@/features/finance/cash-document-actions";
import { CashDocumentPrintButton } from "@/features/finance/cash-document-print-button";
import {
  cashDocumentActions,
  cashDocumentReversalActions,
  type CashDocumentReversalStatus,
  type CashDocumentStatus,
  type CashDocumentType,
} from "@/features/finance/cash-document-workflow";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "收付款单",
  description: "收款单、付款单、审批、资金执行与多单核销",
};

export const dynamic = "force-dynamic";

type AllocationRow = {
  id: string;
  amount: number;
  finance_document:
    | {
        document_no: string;
        document_type: "receivable" | "payable";
        counterparty_name: string;
        total_amount: number;
        settled_amount: number;
        status: string;
      }
    | Array<{
        document_no: string;
        document_type: "receivable" | "payable";
        counterparty_name: string;
        total_amount: number;
        settled_amount: number;
        status: string;
      }>
    | null;
};

type CashDocumentRow = {
  id: string;
  document_no: string;
  document_type: CashDocumentType;
  counterparty_name: string;
  document_date: string;
  payment_channel: "bank" | "wechat" | "alipay" | "cash" | "other";
  account_name: string | null;
  total_amount: number;
  allocated_amount: number;
  bank_reference: string | null;
  summary: string;
  note: string | null;
  status: CashDocumentStatus;
  version: number;
  submitted_at: string | null;
  approved_at: string | null;
  completed_at: string | null;
  created_at: string;
  reversal_status: CashDocumentReversalStatus;
  reversal_reason: string | null;
  reversal_requested_at: string | null;
  reversal_reviewed_at: string | null;
  allocations: AllocationRow[];
};

type FinanceDocumentOption = {
  id: string;
  document_no: string;
  document_type: "receivable" | "payable";
  counterparty_name: string;
  total_amount: number;
  settled_amount: number;
  due_date: string;
};

const money = new Intl.NumberFormat("zh-CN", {
  style: "currency",
  currency: "CNY",
  minimumFractionDigits: 2,
});

const statusStyle: Record<CashDocumentStatus, [string, string]> = {
  draft: ["草稿", "bg-muted text-foreground"],
  submitted: ["待处理", "bg-muted text-foreground"],
  approved: ["已批准", "bg-muted text-foreground"],
  completed: ["已完成", "bg-muted text-foreground"],
  void: ["已作废", "bg-muted text-foreground"],
};

const actionLabels = {
  submit: "提交",
  approve: "批准付款",
  reject: "退回",
  complete: "确认到账/付款",
  void: "作废",
} as const;

const reversalActionLabels = {
  request: "申请红冲",
  approve: "批准红冲",
  reject: "退回红冲",
} as const;

const channelLabels = {
  bank: "银行转账",
  wechat: "微信支付",
  alipay: "支付宝",
  cash: "现金",
  other: "其他",
} as const;

function one<T>(value: T | T[] | null) {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(
    new Date(),
  );
}

export default async function CashDocumentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const employee = await requireCurrentEmployee();
  const feedback = await searchParams;
  const selectedType: CashDocumentType =
    feedback.type === "payment" ? "payment" : "receipt";
  const canRead = employee.roleCodes.some((role) =>
    ["finance", "chairman"].includes(role),
  );
  const canCreate = employee.roleCodes.includes("finance");
  const supabase = await createClient();

  const [cashResult, financeDocumentResult] = canRead
    ? await Promise.all([
        supabase
          .from("finance_cash_documents")
          .select(
            "id, document_no, document_type, counterparty_name, document_date, payment_channel, account_name, total_amount, allocated_amount, bank_reference, summary, note, status, version, submitted_at, approved_at, completed_at, created_at, reversal_status, reversal_reason, reversal_requested_at, reversal_reviewed_at, allocations:finance_cash_allocations(id, amount, finance_document:finance_documents(document_no, document_type, counterparty_name, total_amount, settled_amount, status))",
          )
          .order("document_date", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(200),
        supabase
          .from("finance_documents")
          .select(
            "id, document_no, document_type, counterparty_name, total_amount, settled_amount, due_date",
          )
          .eq(
            "document_type",
            selectedType === "receipt" ? "receivable" : "payable",
          )
          .in("status", ["open", "partial"])
          .order("due_date")
          .limit(300),
      ])
    : [{ data: [], error: null }, { data: [], error: null }];

  const migrationMissing = [cashResult.error, financeDocumentResult.error].some(
    (error) => error?.code === "42P01" || error?.code === "PGRST205",
  );
  const requestError = [cashResult.error, financeDocumentResult.error].find(
    (error) =>
      error && error.code !== "42P01" && error.code !== "PGRST205",
  );
  if (requestError) {
    console.error("cash documents query failed", requestError.code);
    throw new Error("收付款单数据请求失败");
  }

  const cashDocuments = (cashResult.data ?? []) as CashDocumentRow[];
  const financeDocuments = (financeDocumentResult.data ?? []) as FinanceDocumentOption[];
  const visibleDocuments = cashDocuments.filter(
    (document) => document.document_type === selectedType,
  );
  const pendingCount = cashDocuments.filter(
    (document) =>
      ["submitted", "approved"].includes(document.status) ||
      document.reversal_status === "pending",
  ).length;
  const completedAmount = cashDocuments
    .filter(
      (document) =>
        document.status === "completed" && document.reversal_status !== "reversed",
    )
    .reduce((sum, document) => sum + Number(document.total_amount), 0);
  const unappliedAmount = cashDocuments
    .filter(
      (document) =>
        document.status === "completed" && document.reversal_status !== "reversed",
    )
    .reduce(
      (sum, document) =>
        sum + Number(document.total_amount) - Number(document.allocated_amount),
      0,
    );
  return (
    <WorkflowShell
      activeItem="资金管理"
      breadcrumb="财务管理 / 资金管理 / 收付款单"
      currentUser={{
        name: employee.name,
        roleLabel: employee.title ?? "内部员工",
      }}
    >
      <main className="mx-auto max-w-[1440px] p-4 sm:p-6 xl:p-8">
        <section className="ui-page-header">
          <CircleDollarSign className="absolute right-10 top-1/2 hidden size-40 -translate-y-1/2 text-white/[0.06] sm:block" />
          <div className="relative">
            <Link
              className="inline-flex items-center gap-1 text-xs text-white/55"
              href="/finance"
            >
              <ArrowLeft className="size-3" /> 返回财务中心
            </Link>
            <div className="text-xs tracking-[0.18em] text-muted-foreground">
              CASH DOCUMENTS · SETTLEMENT
            </div>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h1 className="text-2xl font-semibold sm:text-[30px]">收款单与付款单</h1>
              <div className="flex flex-wrap gap-2 print:hidden">
                <CashDocumentPrintButton />
                <Link
                  className="inline-flex h-9 items-center gap-2 rounded-md border border-white/20 bg-white/10 px-3 text-xs text-white transition hover:bg-white/15"
                  href="/finance/cash-documents/export"
                >
                  <Download className="size-3.5" /> 导出 Excel
                </Link>
              </div>
            </div>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-white/60">
              独立制单、审批和资金执行；完成时自动生成资金流水、记账凭证，并将一笔收付款分配核销到多张应收应付单据。
            </p>
          </div>
        </section>

        {(feedback.error || feedback.created || feedback.updated) && (
          <div
            className={`mt-4 rounded-md border px-4 py-3 text-xs ${
              feedback.error
                ? "border-border bg-muted text-foreground"
                : "border-border bg-muted text-foreground"
            }`}
          >
            {feedback.error ??
              `${feedback.created ?? feedback.updated}${feedback.warning ? `；${feedback.warning}` : ""}`}
          </div>
        )}
        {migrationMissing && (
          <div className="mt-4 rounded-md border border-border bg-muted px-4 py-3 text-xs text-foreground">
            收付款单数据库迁移尚未执行。
          </div>
        )}

        <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: "全部收付款单",
              value: cashDocuments.length,
              note: "当前权限范围",
              icon: ReceiptText,
            },
            {
              label: "待审批 / 待执行",
              value: pendingCount,
              note: "按状态流转",
              icon: Clock3,
            },
            {
              label: "已完成金额",
              value: money.format(completedAmount),
              note: "已落资金流水与凭证",
              icon: CheckCircle2,
            },
            {
              label: "预收 / 预付余额",
              value: money.format(unappliedAmount),
              note: "尚未分配到往来单据",
              icon: Landmark,
            },
          ].map(({ label, value, note, icon: Icon }) => (
            <article
              className="min-h-[104px] rounded-md border border-border/70 bg-white p-4"
              key={label}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{label}</span>
                <Icon className="size-4 text-foreground" />
              </div>
              <div className="mt-3 text-xl font-semibold text-foreground">
                {value}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{note}</div>
            </article>
          ))}
        </section>

        <div className="mt-5 flex w-fit rounded-md bg-muted p-1 text-xs print:hidden">
          <Link
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 ${selectedType === "receipt" ? "bg-white font-medium text-foreground " : "text-muted-foreground"}`}
            href="/finance/cash-documents?type=receipt"
          >
            <ArrowDownLeft className="size-4" /> 收款单
          </Link>
          <Link
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 ${selectedType === "payment" ? "bg-white font-medium text-foreground " : "text-muted-foreground"}`}
            href="/finance/cash-documents?type=payment"
          >
            <ArrowUpRight className="size-4" /> 付款单
          </Link>
        </div>

        <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(380px,.6fr)] print:block">
          <section className="min-h-[620px] overflow-hidden rounded-md border border-border/70 bg-white">
            <div className="flex items-center justify-between border-b border-border/70 px-5 py-5 sm:px-6">
              <div>
                <h2 className="text-base font-semibold">
                  {selectedType === "receipt" ? "收款单台账" : "付款单台账"}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  单据状态、核销明细与预收预付余额可追溯
                </p>
              </div>
              <span className="text-xs text-muted-foreground">
                {visibleDocuments.length} 张
              </span>
            </div>
            <div className="space-y-3 p-4 sm:p-5">
              {visibleDocuments.map((document) => {
                const [statusLabel, statusClass] = statusStyle[document.status];
                const actions = cashDocumentActions({
                  type: document.document_type,
                  status: document.status,
                  roleCodes: employee.roleCodes,
                });
                const reversalActions = cashDocumentReversalActions({
                  status: document.status,
                  reversalStatus: document.reversal_status,
                  roleCodes: employee.roleCodes,
                });
                const unapplied =
                  Number(document.total_amount) - Number(document.allocated_amount);
                return (
                  <article
                    className="rounded-md border border-border/70 bg-muted p-4"
                    key={document.id}
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-foreground">
                            {document.document_no}
                          </span>
                          <span className={`rounded-full px-2.5 py-1 text-xs ${statusClass}`}>
                            {statusLabel}
                          </span>
                          {document.reversal_status && (
                            <span className={`rounded-full px-2.5 py-1 text-xs ${document.reversal_status === "reversed" ? "bg-muted text-foreground" : "bg-muted text-foreground"}`}>
                              {document.reversal_status === "reversed" ? "已红冲" : "红冲待审批"}
                            </span>
                          )}
                        </div>
                        <h3 className="mt-2 text-sm font-semibold">
                          {document.counterparty_name}
                        </h3>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {document.document_date} · {channelLabels[document.payment_channel]} · {document.account_name ?? "默认账户"}
                        </p>
                        <p className="mt-2 text-xs text-foreground">
                          {document.summary}
                        </p>
                      </div>
                      <div className="sm:text-right">
                        <div className="text-xl font-semibold text-foreground">
                          {money.format(Number(document.total_amount))}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          已分配 {money.format(Number(document.allocated_amount))}
                          {unapplied > 0 ? ` · 未分配 ${money.format(unapplied)}` : ""}
                        </div>
                      </div>
                    </div>

                    {document.allocations.length > 0 && (
                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        {document.allocations.map((allocation) => {
                          const financeDocument = one(allocation.finance_document);
                          return (
                            <div
                              className="rounded-md border border-border bg-white px-3 py-2.5"
                              key={allocation.id}
                            >
                              <div className="text-xs font-medium text-foreground">
                                {financeDocument?.document_no ?? "往来单据"}
                              </div>
                              <div className="mt-1 text-xs text-muted-foreground">
                                {financeDocument?.counterparty_name} · 核销 {money.format(Number(allocation.amount))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {actions.length > 0 && (
                      <form
                        action={transitionCashDocumentAction}
                        className="mt-4 flex flex-col gap-2 border-t border-border/60 pt-4 sm:flex-row sm:items-center print:hidden"
                      >
                        <input name="cashDocumentId" type="hidden" value={document.id} />
                        <input
                          className="h-9 min-w-0 flex-1 rounded-md border border-border bg-white px-3 text-xs"
                          name="note"
                          placeholder="退回或作废时必须填写原因"
                        />
                        <div className="flex flex-wrap gap-2">
                          {actions.map((action) => (
                            <button
                              className={`h-9 rounded-md px-3 text-xs font-medium ${
                                action === "approve" || action === "complete"
                                  ? "bg-primary text-white"
                                  : action === "reject" || action === "void"
                                    ? "border border-border bg-white text-foreground"
                                    : "bg-primary text-white"
                              }`}
                              key={action}
                              name="action"
                              type="submit"
                              value={action}
                            >
                              {actionLabels[action]}
                            </button>
                          ))}
                        </div>
                      </form>
                    )}
                    {reversalActions.length > 0 && (
                      <form
                        action={reverseCashDocumentAction}
                        className="mt-4 flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-center print:hidden"
                      >
                        <input name="cashDocumentId" type="hidden" value={document.id} />
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          <RotateCcw className="size-4 shrink-0 text-foreground" />
                          <input
                            className="h-9 min-w-0 flex-1 rounded-md border border-border bg-white px-3 text-xs"
                            name="note"
                            placeholder={reversalActions.includes("request") ? "填写红冲原因（至少四个字）" : "退回时填写审批意见"}
                          />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {reversalActions.map((action) => (
                            <button
                              className={`h-9 rounded-md px-3 text-xs font-medium ${action === "approve" ? "bg-primary text-white" : "border border-border bg-white text-foreground"}`}
                              key={action}
                              name="action"
                              type="submit"
                              value={action}
                            >
                              {reversalActionLabels[action]}
                            </button>
                          ))}
                        </div>
                      </form>
                    )}
                    {document.reversal_reason && (
                      <p className="mt-3 rounded-md bg-muted px-3 py-2 text-xs leading-5 text-foreground">
                        红冲记录：{document.reversal_reason}
                      </p>
                    )}
                  </article>
                );
              })}
              {!visibleDocuments.length && (
                <div className="py-14 text-center text-xs text-muted-foreground">
                  暂无{selectedType === "receipt" ? "收款单" : "付款单"}
                </div>
              )}
            </div>
          </section>

          <section className="min-h-[620px] rounded-md border border-border/70 bg-white p-5 sm:p-6 print:hidden">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">
                  新建{selectedType === "receipt" ? "收款单" : "付款单"}
                </h2>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  最多同时分配四张往来单据；未分配金额作为预收或预付余额保留。
                </p>
              </div>
              {selectedType === "payment" ? (
                <ShieldCheck className="size-5 text-foreground" />
              ) : (
                <Plus className="size-5 text-foreground" />
              )}
            </div>

            {canCreate ? (
              <form action={createCashDocumentAction} className="mt-5 space-y-3">
                <input name="documentType" type="hidden" value={selectedType} />
                <label className="block text-xs text-muted-foreground">
                  {selectedType === "receipt" ? "付款方" : "收款方"}
                  <input
                    className="mt-1.5 h-10 w-full rounded-md border border-border px-3 text-xs text-foreground"
                    maxLength={120}
                    name="counterpartyName"
                    required
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-xs text-muted-foreground">
                    单据日期
                    <input
                      className="mt-1.5 h-10 w-full rounded-md border border-border px-3 text-xs"
                      defaultValue={today()}
                      name="documentDate"
                      required
                      type="date"
                    />
                  </label>
                  <label className="text-xs text-muted-foreground">
                    收付款方式
                    <select
                      className="mt-1.5 h-10 w-full rounded-md border border-border bg-white px-3 text-xs"
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
                <div className="grid grid-cols-2 gap-3">
                  <input
                    className="h-10 rounded-md border border-border px-3 text-xs"
                    name="accountName"
                    placeholder="公司资金账户"
                  />
                  <input
                    className="h-10 rounded-md border border-border px-3 text-xs"
                    name="bankReference"
                    placeholder="银行流水号"
                  />
                </div>
                <input
                  className="h-10 w-full rounded-md border border-border px-3 text-xs"
                  min="0.01"
                  name="totalAmount"
                  placeholder="收付款总金额"
                  required
                  step="0.01"
                  type="number"
                />
                <input
                  className="h-10 w-full rounded-md border border-border px-3 text-xs"
                  maxLength={160}
                  name="summary"
                  placeholder="业务摘要"
                  required
                />

                <div className="rounded-md border border-border bg-muted p-3">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs font-medium text-foreground">
                      核销明细（选填）
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {financeDocuments.length} 张可选
                    </span>
                  </div>
                  <div className="space-y-2">
                    {[0, 1, 2, 3].map((index) => (
                      <div className="grid grid-cols-[1fr_105px] gap-2" key={index}>
                        <select
                          className="h-9 min-w-0 rounded-md border border-border bg-white px-2 text-xs"
                          name="allocationDocumentId"
                        >
                          <option value="">选择往来单据</option>
                          {financeDocuments.map((document) => (
                            <option key={document.id} value={document.id}>
                              {document.document_no} · {document.counterparty_name} · 余额 {money.format(Number(document.total_amount) - Number(document.settled_amount))}
                            </option>
                          ))}
                        </select>
                        <input
                          className="h-9 rounded-md border border-border bg-white px-2 text-xs"
                          min="0.01"
                          name="allocationAmount"
                          placeholder="核销金额"
                          step="0.01"
                          type="number"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <textarea
                  className="min-h-16 w-full rounded-md border border-border px-3 py-2 text-xs"
                  maxLength={500}
                  name="note"
                  placeholder="备注（选填）"
                />
                {selectedType === "payment" && (
                  <div className="rounded-md bg-muted px-3 py-2.5 text-xs leading-5 text-foreground">
                    付款单提交后由董事长审批；批准后财务才能确认付款。
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    className="h-10 rounded-md border border-border bg-white text-xs font-medium text-foreground"
                    name="intent"
                    type="submit"
                    value="draft"
                  >
                    保存草稿
                  </button>
                  <button
                    className="h-10 rounded-md bg-primary text-xs font-medium text-white"
                    name="intent"
                    type="submit"
                    value="submit"
                  >
                    创建并提交
                  </button>
                </div>
              </form>
            ) : (
              <div className="mt-5 rounded-md bg-muted p-4 text-xs leading-5 text-muted-foreground">
                董事长为审批与只读视图，不能代替财务人员制单。
              </div>
            )}
          </section>
        </div>

        <section className="mt-5 rounded-md border border-border bg-muted p-5">
          <div className="flex items-start gap-3">
            <FileCheck2 className="mt-0.5 size-5 shrink-0 text-foreground" />
            <div>
              <h2 className="text-xs font-semibold text-foreground">入账规则</h2>
              <p className="mt-2 text-xs leading-5 text-foreground">
                草稿、已提交和已批准状态都不会改变应收应付余额。只有点击“确认到账/付款”后，系统才会在一个数据库事务内生成资金流水、已过账凭证、核销记录并更新往来余额，避免审批未完成就提前记账。
              </p>
            </div>
          </div>
        </section>
      </main>
    </WorkflowShell>
  );
}
