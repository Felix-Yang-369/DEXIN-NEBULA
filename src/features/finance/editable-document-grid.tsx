"use client";

import {
  CheckCircle2,
  CircleDollarSign,
  LoaderCircle,
  LockKeyhole,
  PencilLine,
  RotateCcw,
  Save,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  startTransition,
  useMemo,
  useState,
  type KeyboardEvent,
} from "react";
import {
  settleFinanceDocument,
  updateFinanceDocuments,
} from "@/features/finance/server-actions";
import { agingBucket, outstandingAmount } from "@/features/finance/aging";
import {
  hasFinanceSettlement,
  validateFinanceDocumentDraft,
} from "@/features/finance/editable-ledger";
import type {
  FinanceDocumentRow,
  FinanceDocumentSource,
  FinanceDocumentUpdate,
} from "@/features/finance/types";

type EditableField =
  | "document_type"
  | "counterparty_name"
  | "source_type"
  | "source_no"
  | "issue_date"
  | "due_date"
  | "total_amount"
  | "invoice_no"
  | "summary"
  | "note"
  | "status";

type GridMessage = {
  tone: "success" | "error";
  text: string;
} | null;

const currency = new Intl.NumberFormat("zh-CN", {
  style: "currency",
  currency: "CNY",
  minimumFractionDigits: 2,
});

const sourceLabels: Record<FinanceDocumentSource, string> = {
  manual: "手工登记",
  order: "销售订单",
  purchase: "采购订单",
  expense: "费用申请",
  other: "其他",
};

const inputClass =
  "h-8 w-full min-w-0 rounded-md border border-transparent bg-transparent px-2 text-[11px] text-foreground outline-none transition hover:bg-[#f7faf8] focus:border-primary/30 focus:bg-white focus:shadow-[0_0_0_2px_rgba(22,101,82,.08)] disabled:cursor-default disabled:text-foreground disabled:opacity-100";

const cellClass =
  "border-b border-r border-[#e7ece9] px-1.5 py-1.5 align-middle";

function toUpdate(row: FinanceDocumentRow): FinanceDocumentUpdate {
  return {
    id: row.id,
    expectedUpdatedAt: row.updated_at,
    documentType: row.document_type,
    counterpartyName: row.counterparty_name,
    sourceType: row.source_type,
    sourceNo: row.source_no ?? "",
    issueDate: row.issue_date,
    dueDate: row.due_date,
    totalAmount: Number(row.total_amount),
    invoiceNo: row.invoice_no ?? "",
    summary: row.summary,
    note: row.note ?? "",
    status: row.status,
  };
}

function agingLabel(row: FinanceDocumentRow, currentDate: string) {
  if (row.status === "void") return "已作废";
  if (row.status === "settled") return "已结清";
  const bucket = agingBucket(row.due_date, currentDate);
  return bucket === "current" ? "未到期" : `逾期 ${bucket} 天`;
}

export function EditableFinanceDocumentGrid({
  rows,
  canManage,
  currentDate,
}: {
  rows: FinanceDocumentRow[];
  canManage: boolean;
  currentDate: string;
}) {
  const router = useRouter();
  const [draftRows, setDraftRows] = useState(rows);
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<GridMessage>(null);
  const [saving, setSaving] = useState(false);
  const [settlementId, setSettlementId] = useState<string | null>(null);

  const settlementRow = useMemo(
    () => draftRows.find((row) => row.id === settlementId) ?? null,
    [draftRows, settlementId],
  );

  function updateCell(id: string, field: EditableField, value: string) {
    setMessage(null);
    setDraftRows((current) =>
      current.map((row) => {
        if (row.id !== id) return row;
        if (field === "total_amount") {
          return { ...row, total_amount: Number(value) };
        }
        return { ...row, [field]: value } as FinanceDocumentRow;
      }),
    );
    setDirtyIds((current) => new Set(current).add(id));
  }

  function resetChanges() {
    setDraftRows(rows);
    setDirtyIds(new Set());
    setMessage(null);
  }

  async function saveChanges() {
    if (!canManage || saving || dirtyIds.size === 0) return;
    const dirtyRows = draftRows.filter((row) => dirtyIds.has(row.id));
    const validationError = dirtyRows
      .map((row) => validateFinanceDocumentDraft(row))
      .find(Boolean);

    if (validationError) {
      setMessage({ tone: "error", text: validationError });
      return;
    }

    setSaving(true);
    setMessage(null);
    const result = await updateFinanceDocuments(dirtyRows.map(toUpdate));
    setSaving(false);

    if (!result.success) {
      setMessage({ tone: "error", text: result.message });
      return;
    }

    setDirtyIds(new Set());
    setMessage({
      tone: "success",
      text: `已保存 ${result.updatedCount} 行，财务台账与审计记录已同步更新。`,
    });
    startTransition(() => router.refresh());
  }

  function handleShortcut(event: KeyboardEvent<HTMLDivElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      void saveChanges();
    }
  }

  function handleCellKeyDown(
    event: KeyboardEvent<HTMLInputElement>,
    rowIndex: number,
    field: EditableField,
  ) {
    if (event.key === "Enter") {
      event.preventDefault();
      const nextCell = document.querySelector<HTMLElement>(
        `[data-grid-row="${rowIndex + 1}"][data-grid-field="${field}"]`,
      );
      nextCell?.focus();
    }
  }

  return (
    <div onKeyDown={handleShortcut}>
      <div className="flex flex-col gap-3 border-b border-[#e7ece9] bg-[#fbfcfc] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3 text-[10px]">
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            {canManage ? (
              <PencilLine className="size-3.5 text-primary" />
            ) : (
              <LockKeyhole className="size-3.5" />
            )}
            {canManage
              ? "点击单元格直接编辑，Tab 横向移动，Enter 向下移动"
              : "董事长只读视图，财务角色可编辑"}
          </span>
          {dirtyIds.size > 0 && (
            <span className="rounded-full bg-[#fff4e7] px-2.5 py-1 font-medium text-[#94601f]">
              {dirtyIds.size} 行待保存
            </span>
          )}
          {message && (
            <span
              className={`inline-flex items-center gap-1.5 ${
                message.tone === "success" ? "text-[#0d7580]" : "text-[#a65548]"
              }`}
            >
              {message.tone === "success" && <CheckCircle2 className="size-3.5" />}
              {message.text}
            </span>
          )}
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <button
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-white px-3 text-[10px] text-muted-foreground transition hover:text-foreground disabled:opacity-40"
              disabled={dirtyIds.size === 0 || saving}
              onClick={resetChanges}
              type="button"
            >
              <RotateCcw className="size-3.5" />
              撤销修改
            </button>
            <button
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-[10px] font-medium text-primary-foreground transition hover:bg-primary/92 disabled:opacity-45"
              disabled={dirtyIds.size === 0 || saving}
              onClick={() => void saveChanges()}
              type="button"
            >
              {saving ? (
                <LoaderCircle className="size-3.5 animate-spin" />
              ) : (
                <Save className="size-3.5" />
              )}
              {saving ? "保存中" : "保存全部"}
              <span className="hidden opacity-60 lg:inline">⌘/Ctrl + S</span>
            </button>
          </div>
        )}
      </div>

      <div className="max-h-[620px] overflow-auto">
        <table className="w-full min-w-[1900px] table-fixed border-separate border-spacing-0 text-left">
          <thead className="sticky top-0 z-20 bg-[#f2f6f4] text-[9px] font-medium text-[#61716b]">
            <tr>
              <th className="sticky left-0 z-30 w-10 border-b border-r border-[#dce6ed] bg-[#edf3f0] px-2 py-2.5 text-center">
                #
              </th>
              <th className="w-20 border-b border-r border-[#dce6ed] px-2 py-2.5">类型</th>
              <th className="w-40 border-b border-r border-[#dce6ed] px-2 py-2.5">单据编号</th>
              <th className="w-52 border-b border-r border-[#dce6ed] px-2 py-2.5">往来单位</th>
              <th className="w-56 border-b border-r border-[#dce6ed] px-2 py-2.5">业务摘要</th>
              <th className="w-52 border-b border-r border-[#dce6ed] px-2 py-2.5">来源 / 来源单号</th>
              <th className="w-32 border-b border-r border-[#dce6ed] px-2 py-2.5">单据日期</th>
              <th className="w-32 border-b border-r border-[#dce6ed] px-2 py-2.5">到期日期</th>
              <th className="w-36 border-b border-r border-[#dce6ed] px-2 py-2.5 text-right">原始金额</th>
              <th className="w-36 border-b border-r border-[#dce6ed] px-3 py-2.5 text-right">已核销</th>
              <th className="w-36 border-b border-r border-[#dce6ed] px-3 py-2.5 text-right">未结余额</th>
              <th className="w-40 border-b border-r border-[#dce6ed] px-2 py-2.5">发票号码</th>
              <th className="w-28 border-b border-r border-[#dce6ed] px-2 py-2.5">状态</th>
              <th className="w-56 border-b border-r border-[#dce6ed] px-2 py-2.5">备注</th>
              <th className="w-28 border-b border-[#dce6ed] px-2 py-2.5">操作</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {draftRows.map((row, rowIndex) => {
              const dirty = dirtyIds.has(row.id);
              const hasSettlement = hasFinanceSettlement(row.settled_amount);
              const outstanding = outstandingAmount(
                Number(row.total_amount),
                Number(row.settled_amount),
              );
              const statusText = agingLabel(row, currentDate);

              return (
                <tr
                  className={`group ${dirty ? "bg-[#fffdf7]" : "hover:bg-[#fbfcfc]"}`}
                  key={row.id}
                >
                  <td
                    className={`sticky left-0 z-10 border-b border-r border-[#e2e9e5] px-2 py-2 text-center font-mono text-[9px] ${
                      dirty
                        ? "bg-[#fff7df] font-semibold text-[#94601f]"
                        : "bg-[#f8fafc] text-muted-foreground"
                    }`}
                  >
                    {rowIndex + 1}
                  </td>
                  <td className={cellClass}>
                    <select
                      className={inputClass}
                      data-grid-field="document_type"
                      data-grid-row={rowIndex}
                      disabled={!canManage || hasSettlement}
                      onChange={(event) =>
                        updateCell(row.id, "document_type", event.target.value)
                      }
                      value={row.document_type}
                    >
                      <option value="receivable">应收</option>
                      <option value="payable">应付</option>
                    </select>
                  </td>
                  <td className={`${cellClass} px-3 font-mono text-[9px] text-muted-foreground`}>
                    {row.document_no}
                  </td>
                  <td className={cellClass}>
                    <input
                      className={inputClass}
                      data-grid-field="counterparty_name"
                      data-grid-row={rowIndex}
                      disabled={!canManage}
                      maxLength={100}
                      onChange={(event) =>
                        updateCell(row.id, "counterparty_name", event.target.value)
                      }
                      onKeyDown={(event) =>
                        handleCellKeyDown(event, rowIndex, "counterparty_name")
                      }
                      value={row.counterparty_name}
                    />
                  </td>
                  <td className={cellClass}>
                    <input
                      className={inputClass}
                      data-grid-field="summary"
                      data-grid-row={rowIndex}
                      disabled={!canManage}
                      maxLength={160}
                      onChange={(event) =>
                        updateCell(row.id, "summary", event.target.value)
                      }
                      onKeyDown={(event) =>
                        handleCellKeyDown(event, rowIndex, "summary")
                      }
                      value={row.summary}
                    />
                  </td>
                  <td className={cellClass}>
                    <div className="grid grid-cols-[92px_1fr] gap-1">
                      <select
                        className={inputClass}
                        data-grid-field="source_type"
                        data-grid-row={rowIndex}
                        disabled={!canManage}
                        onChange={(event) =>
                          updateCell(row.id, "source_type", event.target.value)
                        }
                        value={row.source_type}
                      >
                        {Object.entries(sourceLabels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                      <input
                        className={inputClass}
                        data-grid-field="source_no"
                        data-grid-row={rowIndex}
                        disabled={!canManage}
                        maxLength={100}
                        onChange={(event) =>
                          updateCell(row.id, "source_no", event.target.value)
                        }
                        onKeyDown={(event) =>
                          handleCellKeyDown(event, rowIndex, "source_no")
                        }
                        placeholder="来源单号"
                        value={row.source_no ?? ""}
                      />
                    </div>
                  </td>
                  <td className={cellClass}>
                    <input
                      className={inputClass}
                      data-grid-field="issue_date"
                      data-grid-row={rowIndex}
                      disabled={!canManage}
                      onChange={(event) =>
                        updateCell(row.id, "issue_date", event.target.value)
                      }
                      onKeyDown={(event) =>
                        handleCellKeyDown(event, rowIndex, "issue_date")
                      }
                      type="date"
                      value={row.issue_date}
                    />
                  </td>
                  <td className={cellClass}>
                    <input
                      className={inputClass}
                      data-grid-field="due_date"
                      data-grid-row={rowIndex}
                      disabled={!canManage}
                      onChange={(event) =>
                        updateCell(row.id, "due_date", event.target.value)
                      }
                      onKeyDown={(event) =>
                        handleCellKeyDown(event, rowIndex, "due_date")
                      }
                      type="date"
                      value={row.due_date}
                    />
                  </td>
                  <td className={cellClass}>
                    <input
                      className={`${inputClass} text-right font-medium`}
                      data-grid-field="total_amount"
                      data-grid-row={rowIndex}
                      disabled={!canManage || hasSettlement}
                      min="0.01"
                      onChange={(event) =>
                        updateCell(row.id, "total_amount", event.target.value)
                      }
                      onKeyDown={(event) =>
                        handleCellKeyDown(event, rowIndex, "total_amount")
                      }
                      step="0.01"
                      type="number"
                      value={row.total_amount}
                    />
                  </td>
                  <td className={`${cellClass} px-3 text-right text-[10px] text-muted-foreground`}>
                    {currency.format(Number(row.settled_amount))}
                  </td>
                  <td className={`${cellClass} px-3 text-right text-[11px] font-semibold`}>
                    {currency.format(outstanding)}
                  </td>
                  <td className={cellClass}>
                    <input
                      className={inputClass}
                      data-grid-field="invoice_no"
                      data-grid-row={rowIndex}
                      disabled={!canManage}
                      maxLength={100}
                      onChange={(event) =>
                        updateCell(row.id, "invoice_no", event.target.value)
                      }
                      onKeyDown={(event) =>
                        handleCellKeyDown(event, rowIndex, "invoice_no")
                      }
                      placeholder="未开票"
                      value={row.invoice_no ?? ""}
                    />
                  </td>
                  <td className={cellClass}>
                    {hasSettlement ? (
                      <div
                        className={`rounded-md px-2 py-1.5 text-center text-[9px] ${
                          row.status === "settled"
                            ? "bg-[#edf4f7] text-[#0d7580]"
                            : "bg-[#fff5e8] text-[#966320]"
                        }`}
                      >
                        {statusText}
                      </div>
                    ) : (
                      <select
                        className={inputClass}
                        data-grid-field="status"
                        data-grid-row={rowIndex}
                        disabled={!canManage}
                        onChange={(event) =>
                          updateCell(row.id, "status", event.target.value)
                        }
                        value={row.status}
                      >
                        <option value="open">未结</option>
                        <option value="void">作废</option>
                      </select>
                    )}
                  </td>
                  <td className={cellClass}>
                    <input
                      className={inputClass}
                      data-grid-field="note"
                      data-grid-row={rowIndex}
                      disabled={!canManage}
                      maxLength={500}
                      onChange={(event) =>
                        updateCell(row.id, "note", event.target.value)
                      }
                      onKeyDown={(event) =>
                        handleCellKeyDown(event, rowIndex, "note")
                      }
                      placeholder="添加备注"
                      value={row.note ?? ""}
                    />
                  </td>
                  <td className="border-b border-[#e7ece9] px-2 py-1.5">
                    {canManage && outstanding > 0 && row.status !== "void" ? (
                      <button
                        className="inline-flex h-7 w-full items-center justify-center gap-1 rounded-md bg-[#eaf3f8] px-2 text-[9px] font-medium text-[#0d6c78] transition hover:bg-[#dcece5] disabled:cursor-not-allowed disabled:opacity-45"
                        disabled={dirty}
                        onClick={() => setSettlementId(row.id)}
                        title={dirty ? "请先保存本行修改" : "登记收付款并核销"}
                        type="button"
                      >
                        <CircleDollarSign className="size-3.5" />
                        核销
                      </button>
                    ) : (
                      <span className="block text-center text-[9px] text-muted-foreground">
                        {row.status === "void" ? "已作废" : "—"}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#e7ece9] bg-[#fbfcfc] px-4 py-2.5 text-[9px] text-muted-foreground">
        <span>共 {draftRows.length} 行 · 金额与已核销数据按人民币显示</span>
        <span>已核销单据的类型和原始金额锁定，避免破坏凭证链路</span>
      </div>

      {settlementRow && (
        <div
          aria-label="收付款核销"
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center bg-[#082f28]/35 p-4 backdrop-blur-[2px]"
          role="dialog"
        >
          <section className="w-full max-w-xl rounded-[20px] border border-white/60 bg-white p-5 shadow-[0_24px_80px_-30px_rgba(5,45,37,.55)] sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[10px] font-medium tracking-[0.12em] text-primary">
                  {settlementRow.document_type === "receivable"
                    ? "RECEIPT · 收款核销"
                    : "PAYMENT · 付款核销"}
                </div>
                <h3 className="mt-2 text-base font-semibold">
                  {settlementRow.counterparty_name}
                </h3>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {settlementRow.document_no} · 未结余额{" "}
                  {currency.format(
                    outstandingAmount(
                      settlementRow.total_amount,
                      settlementRow.settled_amount,
                    ),
                  )}
                </p>
              </div>
              <button
                aria-label="关闭核销窗口"
                className="grid size-8 place-items-center rounded-lg bg-[#f3f6f4] text-muted-foreground hover:text-foreground"
                onClick={() => setSettlementId(null)}
                type="button"
              >
                <X className="size-4" />
              </button>
            </div>
            <form action={settleFinanceDocument} className="mt-5 grid gap-3 sm:grid-cols-2">
              <input name="documentId" type="hidden" value={settlementRow.id} />
              <label className="text-[10px] text-muted-foreground">
                核销金额
                <input
                  className="mt-1.5 h-10 w-full rounded-xl border border-border bg-white px-3 text-xs text-foreground outline-none focus:border-primary/40"
                  defaultValue={outstandingAmount(
                    settlementRow.total_amount,
                    settlementRow.settled_amount,
                  )}
                  max={outstandingAmount(
                    settlementRow.total_amount,
                    settlementRow.settled_amount,
                  )}
                  min="0.01"
                  name="amount"
                  required
                  step="0.01"
                  type="number"
                />
              </label>
              <label className="text-[10px] text-muted-foreground">
                收付款日期
                <input
                  className="mt-1.5 h-10 w-full rounded-xl border border-border bg-white px-3 text-xs"
                  defaultValue={currentDate}
                  name="settledOn"
                  required
                  type="date"
                />
              </label>
              <select className="h-10 rounded-xl border border-border bg-white px-3 text-xs" name="paymentChannel">
                <option value="bank">银行转账</option>
                <option value="wechat">微信支付</option>
                <option value="alipay">支付宝</option>
                <option value="cash">现金</option>
                <option value="other">其他</option>
              </select>
              <input className="h-10 rounded-xl border border-border bg-white px-3 text-xs" name="accountName" placeholder="收付款账户" />
              <input
                className="h-10 rounded-xl border border-border bg-white px-3 text-xs"
                defaultValue={
                  settlementRow.document_type === "receivable"
                    ? "银行存款"
                    : "应付账款"
                }
                name="debitAccount"
                required
              />
              <input
                className="h-10 rounded-xl border border-border bg-white px-3 text-xs"
                defaultValue={
                  settlementRow.document_type === "receivable"
                    ? "应收账款"
                    : "银行存款"
                }
                name="creditAccount"
                required
              />
              <input className="h-10 rounded-xl border border-border bg-white px-3 text-xs" min="0" name="attachmentCount" placeholder="附件张数" type="number" />
              <input className="h-10 rounded-xl border border-border bg-white px-3 text-xs" name="note" placeholder="核销备注（选填）" />
              <button className="h-10 rounded-xl bg-primary px-4 text-xs font-medium text-primary-foreground sm:col-span-2" type="submit">
                确认核销并生成流水与凭证
              </button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
