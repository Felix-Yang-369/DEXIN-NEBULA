"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import type { FinanceDocumentUpdate } from "@/features/finance/types";
import { createClient } from "@/lib/supabase/server";

const allowedTypes = new Set(["income", "expense"]);
const allowedChannels = new Set(["bank", "wechat", "alipay", "cash", "other"]);
const allowedStatuses = new Set(["draft", "confirmed"]);
const allowedDocumentTypes = new Set(["receivable", "payable"]);
const allowedSourceTypes = new Set(["manual", "order", "purchase", "expense", "other"]);
const allowedVoucherTypes = new Set(["receipt", "payment", "transfer", "general"]);
const allowedVoucherStatuses = new Set(["draft", "posted"]);

const financeDocumentUpdateSchema = z
  .array(
    z
      .object({
        id: z.uuid(),
        expectedUpdatedAt: z.string().min(10).max(50),
        documentType: z.enum(["receivable", "payable"]),
        counterpartyName: z.string().trim().min(1).max(100),
        sourceType: z.enum([
          "manual",
          "order",
          "purchase",
          "expense",
          "other",
        ]),
        sourceNo: z.string().trim().max(100),
        issueDate: z.iso.date(),
        dueDate: z.iso.date(),
        totalAmount: z.number().positive().max(100000000),
        invoiceNo: z.string().trim().max(100),
        summary: z.string().trim().min(1).max(160),
        note: z.string().trim().max(500),
        status: z.enum(["open", "partial", "settled", "void"]),
      })
      .refine((row) => row.dueDate >= row.issueDate, {
        message: "到期日不能早于单据日期",
      }),
  )
  .min(1)
  .max(100);

export type FinanceDocumentUpdateResult =
  | {
      success: true;
      updatedCount: number;
    }
  | {
      success: false;
      message: string;
    };

function stringValue(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function financeRedirect(
  params: Record<string, string>,
  anchor = "entry",
): never {
  const query = new URLSearchParams(params);
  redirect(`/finance?${query.toString()}#${anchor}`);
}

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function validAmount(value: number) {
  return Number.isFinite(value) && value > 0 && value <= 100000000;
}

function optionalUuid(value: string) {
  return value && /^[0-9a-f-]{36}$/i.test(value) ? value : null;
}

export async function createFinanceTransaction(formData: FormData) {
  const employee = await requireCurrentEmployee();

  if (!employee.roleCodes.includes("finance")) {
    financeRedirect({ error: "只有财务角色可以登记收支" });
  }

  const transactionType = stringValue(formData, "transactionType");
  const category = stringValue(formData, "category");
  const counterparty = stringValue(formData, "counterparty");
  const amount = Number(stringValue(formData, "amount"));
  const occurredOn = stringValue(formData, "occurredOn");
  const paymentChannel = stringValue(formData, "paymentChannel");
  const accountName = stringValue(formData, "accountName");
  const voucherNo = stringValue(formData, "voucherNo");
  const status = stringValue(formData, "status");
  const note = stringValue(formData, "note");

  if (!allowedTypes.has(transactionType)) {
    financeRedirect({ error: "请选择正确的收支类型" });
  }

  if (!category || category.length > 40) {
    financeRedirect({ error: "请输入 1 至 40 个字的收支分类" });
  }

  if (!Number.isFinite(amount) || amount <= 0 || amount > 100000000) {
    financeRedirect({ error: "请输入有效金额" });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(occurredOn)) {
    financeRedirect({ error: "请选择业务日期" });
  }

  if (!allowedChannels.has(paymentChannel)) {
    financeRedirect({ error: "请选择正确的收付款方式" });
  }

  if (!allowedStatuses.has(status)) {
    financeRedirect({ error: "请选择正确的单据状态" });
  }

  const supabase = await createClient();
  const transactionNo = `DXF-${occurredOn.replaceAll("-", "")}-${crypto.randomUUID()
    .replaceAll("-", "")
    .slice(0, 6)
    .toUpperCase()}`;

  const { error } = await supabase.from("finance_transactions").insert({
    organization_id: employee.organizationId,
    transaction_no: transactionNo,
    transaction_type: transactionType,
    category,
    counterparty: counterparty || null,
    amount,
    occurred_on: occurredOn,
    payment_channel: paymentChannel,
    account_name: accountName || null,
    voucher_no: voucherNo || null,
    status,
    note: note || null,
    created_by_employee_id: employee.id,
  });

  if (error) {
    console.error("createFinanceTransaction failed", error.code);
    financeRedirect({ error: "登记失败，请检查权限或稍后重试" });
  }

  revalidatePath("/finance");
  financeRedirect({ created: transactionNo });
}

export async function createFinanceDocument(formData: FormData) {
  const employee = await requireCurrentEmployee();
  if (!employee.roleCodes.includes("finance")) {
    financeRedirect({ error: "只有财务角色可以登记应收应付" }, "documents");
  }

  const documentType = stringValue(formData, "documentType");
  const legalEntityId = optionalUuid(stringValue(formData, "legalEntityId"));
  const counterpartyName = stringValue(formData, "counterpartyName");
  const sourceType = stringValue(formData, "sourceType");
  const sourceNo = stringValue(formData, "sourceNo");
  const issueDate = stringValue(formData, "issueDate");
  const dueDate = stringValue(formData, "dueDate");
  const totalAmount = Number(stringValue(formData, "totalAmount"));
  const invoiceNo = stringValue(formData, "invoiceNo");
  const summary = stringValue(formData, "summary");
  const note = stringValue(formData, "note");

  if (!allowedDocumentTypes.has(documentType)) {
    financeRedirect({ error: "请选择应收或应付" }, "documents");
  }
  if ((!legalEntityId && !counterpartyName) || counterpartyName.length > 100) {
    financeRedirect(
      { error: "客户往来请选择法律实体，其他往来请输入单位名称" },
      "documents",
    );
  }
  if (!allowedSourceTypes.has(sourceType)) {
    financeRedirect({ error: "请选择正确的业务来源" }, "documents");
  }
  if (!validDate(issueDate) || !validDate(dueDate) || dueDate < issueDate) {
    financeRedirect({ error: "到期日不能早于单据日期" }, "documents");
  }
  if (!validAmount(totalAmount)) {
    financeRedirect({ error: "请输入有效的应收应付金额" }, "documents");
  }
  if (!summary || summary.length > 160) {
    financeRedirect({ error: "请输入 1 至 160 个字的业务摘要" }, "documents");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_finance_document", {
    p_document_type: documentType,
    p_customer_id: null,
    p_legal_entity_id: legalEntityId,
    p_counterparty_name: counterpartyName || null,
    p_source_type: sourceType,
    p_source_no: sourceNo || null,
    p_issue_date: issueDate,
    p_due_date: dueDate,
    p_total_amount: totalAmount,
    p_invoice_no: invoiceNo || null,
    p_summary: summary,
    p_note: note || null,
  });

  if (error) {
    console.error("createFinanceDocument failed", error.code);
    financeRedirect({ error: "往来单据创建失败，请检查填写内容" }, "documents");
  }

  revalidatePath("/finance");
  financeRedirect({ documentCreated: String(data) }, "documents");
}

export async function updateFinanceDocuments(
  input: FinanceDocumentUpdate[],
): Promise<FinanceDocumentUpdateResult> {
  const employee = await requireCurrentEmployee();

  if (!employee.roleCodes.includes("finance")) {
    return {
      success: false,
      message: "只有财务角色可以编辑应收应付台账。",
    };
  }

  const parsed = financeDocumentUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "请检查待保存的数据。",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("update_finance_documents", {
    p_updates: parsed.data,
  });

  if (error) {
    console.error("updateFinanceDocuments failed", error.code);
    const message = error.message.toLowerCase();

    if (message.includes("concurrent") || message.includes("其他人更新")) {
      return {
        success: false,
        message: "部分数据已被其他人更新，请刷新页面后重新编辑。",
      };
    }
    if (message.includes("settlement") || message.includes("核销")) {
      return {
        success: false,
        message: "已发生核销的单据不能修改类型或原始金额。",
      };
    }

    return {
      success: false,
      message: "保存失败，请检查数据或稍后重试。",
    };
  }

  const updatedRows = Array.isArray(data) ? data : [];
  revalidatePath("/finance");
  return {
    success: true,
    updatedCount: updatedRows.length || parsed.data.length,
  };
}

export async function settleFinanceDocument(formData: FormData) {
  const employee = await requireCurrentEmployee();
  if (!employee.roleCodes.includes("finance")) {
    financeRedirect({ error: "只有财务角色可以执行核销" }, "documents");
  }

  const documentId = stringValue(formData, "documentId");
  const amount = Number(stringValue(formData, "amount"));
  const settledOn = stringValue(formData, "settledOn");
  const paymentChannel = stringValue(formData, "paymentChannel");
  const accountName = stringValue(formData, "accountName");
  const debitAccount = stringValue(formData, "debitAccount");
  const creditAccount = stringValue(formData, "creditAccount");
  const attachmentCount = Number(stringValue(formData, "attachmentCount") || "0");
  const note = stringValue(formData, "note");

  if (!/^[0-9a-f-]{36}$/i.test(documentId)) {
    financeRedirect({ error: "无效的往来单据" }, "documents");
  }
  if (!validAmount(amount)) {
    financeRedirect({ error: "请输入有效的核销金额" }, "documents");
  }
  if (!validDate(settledOn) || !allowedChannels.has(paymentChannel)) {
    financeRedirect({ error: "请选择正确的收付款日期与方式" }, "documents");
  }
  if (!debitAccount || !creditAccount) {
    financeRedirect({ error: "请填写借方与贷方科目" }, "documents");
  }
  if (!Number.isInteger(attachmentCount) || attachmentCount < 0) {
    financeRedirect({ error: "附件张数必须为非负整数" }, "documents");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("settle_finance_document", {
    p_document_id: documentId,
    p_amount: amount,
    p_settled_on: settledOn,
    p_payment_channel: paymentChannel,
    p_account_name: accountName || null,
    p_debit_account: debitAccount,
    p_credit_account: creditAccount,
    p_attachment_count: attachmentCount,
    p_note: note || null,
  });

  if (error) {
    console.error("settleFinanceDocument failed", error.code);
    financeRedirect(
      { error: error.message.includes("remaining") ? "核销金额超过未结余额" : "核销失败，请稍后重试" },
      "documents",
    );
  }

  const result = data as { settlementNo?: string } | null;
  revalidatePath("/finance");
  financeRedirect(
    { settled: result?.settlementNo ?? "已完成" },
    "documents",
  );
}

export async function createFinanceVoucher(formData: FormData) {
  const employee = await requireCurrentEmployee();
  if (!employee.roleCodes.includes("finance")) {
    financeRedirect({ error: "只有财务角色可以登记凭证" }, "vouchers");
  }

  const voucherDate = stringValue(formData, "voucherDate");
  const voucherType = stringValue(formData, "voucherType");
  const summary = stringValue(formData, "summary");
  const debitAccount = stringValue(formData, "debitAccount");
  const creditAccount = stringValue(formData, "creditAccount");
  const amount = Number(stringValue(formData, "amount"));
  const attachmentCount = Number(stringValue(formData, "attachmentCount") || "0");
  const status = stringValue(formData, "status");

  if (!validDate(voucherDate) || !allowedVoucherTypes.has(voucherType)) {
    financeRedirect({ error: "请选择正确的凭证日期与类型" }, "vouchers");
  }
  if (!summary || !debitAccount || !creditAccount || !validAmount(amount)) {
    financeRedirect({ error: "请完整填写凭证摘要、科目和金额" }, "vouchers");
  }
  if (
    !Number.isInteger(attachmentCount) ||
    attachmentCount < 0 ||
    !allowedVoucherStatuses.has(status)
  ) {
    financeRedirect({ error: "凭证状态或附件张数不正确" }, "vouchers");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_finance_voucher", {
    p_voucher_date: voucherDate,
    p_voucher_type: voucherType,
    p_summary: summary,
    p_debit_account: debitAccount,
    p_credit_account: creditAccount,
    p_amount: amount,
    p_attachment_count: attachmentCount,
    p_status: status,
  });

  if (error) {
    console.error("createFinanceVoucher failed", error.code);
    financeRedirect({ error: "凭证登记失败，请检查填写内容" }, "vouchers");
  }

  revalidatePath("/finance");
  financeRedirect({ voucherCreated: String(data) }, "vouchers");
}
