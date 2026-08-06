import type { FinanceDocumentRow } from "@/features/finance/types";

type EditableFinanceDocumentDraft = Pick<
  FinanceDocumentRow,
  | "counterparty_name"
  | "summary"
  | "total_amount"
  | "issue_date"
  | "due_date"
>;

export function hasFinanceSettlement(settledAmount: number) {
  return Number(settledAmount) > 0;
}

export function validateFinanceDocumentDraft(
  row: EditableFinanceDocumentDraft,
) {
  if (!row.counterparty_name.trim()) return "往来单位不能为空";
  if (!row.summary.trim()) return "业务摘要不能为空";
  if (!Number.isFinite(Number(row.total_amount)) || Number(row.total_amount) <= 0) {
    return "单据金额必须大于 0";
  }
  if (row.due_date < row.issue_date) return "到期日不能早于单据日期";
  return null;
}
