"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import { createClient } from "@/lib/supabase/server";

const cashDocumentSchema = z.object({
  documentType: z.enum(["receipt", "payment"]),
  counterpartyName: z.string().trim().min(2).max(120),
  documentDate: z.iso.date(),
  paymentChannel: z.enum(["bank", "wechat", "alipay", "cash", "other"]),
  accountName: z.string().trim().max(100),
  totalAmount: z.coerce.number().positive().max(999999999999.99),
  bankReference: z.string().trim().max(100),
  summary: z.string().trim().min(2).max(160),
  note: z.string().trim().max(500),
  intent: z.enum(["draft", "submit"]),
});

const transitionSchema = z.object({
  cashDocumentId: z.uuid(),
  action: z.enum(["submit", "approve", "reject", "complete", "void"]),
  note: z.string().trim().max(500),
});

const reversalSchema = z.object({
  cashDocumentId: z.uuid(),
  action: z.enum(["request", "approve", "reject"]),
  note: z.string().trim().max(500),
});

function cashDocumentRedirect(params: Record<string, string>): never {
  redirect(`/finance/cash-documents?${new URLSearchParams(params)}`);
}

function parseAllocations(formData: FormData) {
  const ids = formData.getAll("allocationDocumentId").map(String);
  const amounts = formData.getAll("allocationAmount").map(String);
  const allocations: Array<{ document_id: string; amount: number }> = [];

  for (let index = 0; index < Math.max(ids.length, amounts.length); index += 1) {
    const documentId = (ids[index] ?? "").trim();
    const rawAmount = (amounts[index] ?? "").trim();
    if (!documentId && !rawAmount) continue;
    const amount = Number(rawAmount);
    if (!z.uuid().safeParse(documentId).success || !Number.isFinite(amount) || amount <= 0) {
      cashDocumentRedirect({ error: "核销明细中的单据和金额必须完整有效" });
    }
    allocations.push({ document_id: documentId, amount });
  }

  if (new Set(allocations.map((item) => item.document_id)).size !== allocations.length) {
    cashDocumentRedirect({ error: "同一张应收应付单不能重复选择" });
  }
  return allocations;
}

export async function createCashDocumentAction(formData: FormData) {
  const employee = await requireCurrentEmployee();
  if (!employee.roleCodes.includes("finance")) {
    cashDocumentRedirect({ error: "只有财务角色可以创建收付款单" });
  }

  const parsed = cashDocumentSchema.safeParse({
    documentType: formData.get("documentType"),
    counterpartyName: formData.get("counterpartyName"),
    documentDate: formData.get("documentDate"),
    paymentChannel: formData.get("paymentChannel"),
    accountName: formData.get("accountName") ?? "",
    totalAmount: formData.get("totalAmount"),
    bankReference: formData.get("bankReference") ?? "",
    summary: formData.get("summary"),
    note: formData.get("note") ?? "",
    intent: formData.get("intent"),
  });
  if (!parsed.success) {
    cashDocumentRedirect({ error: "请完整填写收付款单必填信息" });
  }

  const allocations = parseAllocations(formData);
  const allocatedAmount = allocations.reduce((sum, item) => sum + item.amount, 0);
  if (allocatedAmount > parsed.data.totalAmount) {
    cashDocumentRedirect({ error: "核销金额合计不能超过收付款金额" });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_finance_cash_document", {
    p_document_type: parsed.data.documentType,
    p_counterparty_name: parsed.data.counterpartyName,
    p_document_date: parsed.data.documentDate,
    p_payment_channel: parsed.data.paymentChannel,
    p_account_name: parsed.data.accountName || null,
    p_total_amount: parsed.data.totalAmount,
    p_bank_reference: parsed.data.bankReference || null,
    p_summary: parsed.data.summary,
    p_note: parsed.data.note || null,
    p_allocations: allocations,
  });
  if (error) {
    console.error("createCashDocumentAction failed", error.code);
    cashDocumentRedirect({ error: "创建失败，请检查核销单据余额或稍后重试" });
  }

  const created = data as { id?: string; documentNo?: string } | null;
  if (!created?.id) {
    cashDocumentRedirect({ error: "创建失败，未返回收付款单编号" });
  }

  if (parsed.data.intent === "submit") {
    const { error: submitError } = await supabase.rpc(
      "transition_finance_cash_document",
      {
        p_cash_document_id: created.id,
        p_action: "submit",
        p_note: null,
      },
    );
    if (submitError) {
      console.error("submit cash document failed", submitError.code);
      cashDocumentRedirect({
        created: created.documentNo ?? "草稿已保存",
        warning: "单据已保存为草稿，但提交失败",
      });
    }
  }

  revalidatePath("/finance");
  revalidatePath("/finance/cash-documents");
  cashDocumentRedirect({
    created: created.documentNo ?? "创建成功",
    status: parsed.data.intent === "submit" ? "submitted" : "draft",
  });
}

export async function transitionCashDocumentAction(formData: FormData) {
  await requireCurrentEmployee();
  const parsed = transitionSchema.safeParse({
    cashDocumentId: formData.get("cashDocumentId"),
    action: formData.get("action"),
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) {
    cashDocumentRedirect({ error: "收付款单操作参数无效" });
  }
  if (["reject", "void"].includes(parsed.data.action) && parsed.data.note.length < 2) {
    cashDocumentRedirect({ error: "退回或作废必须填写原因" });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "transition_finance_cash_document",
    {
      p_cash_document_id: parsed.data.cashDocumentId,
      p_action: parsed.data.action,
      p_note: parsed.data.note || null,
    },
  );
  if (error) {
    console.error("transitionCashDocumentAction failed", error.code);
    cashDocumentRedirect({ error: "操作失败，单据状态或核销余额可能已变化" });
  }

  const result = data as { documentNo?: string; status?: string } | null;
  revalidatePath("/finance");
  revalidatePath("/finance/cash-documents");
  cashDocumentRedirect({
    updated: result?.documentNo ?? "操作成功",
    status: result?.status ?? "updated",
  });
}

export async function reverseCashDocumentAction(formData: FormData) {
  await requireCurrentEmployee();
  const parsed = reversalSchema.safeParse({
    cashDocumentId: formData.get("cashDocumentId"),
    action: formData.get("action"),
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) {
    cashDocumentRedirect({ error: "红冲操作参数无效" });
  }
  if (parsed.data.action === "request" && parsed.data.note.length < 4) {
    cashDocumentRedirect({ error: "红冲申请必须填写不少于四个字的原因" });
  }
  if (parsed.data.action === "reject" && parsed.data.note.length < 2) {
    cashDocumentRedirect({ error: "退回红冲申请必须填写审批意见" });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reverse_finance_cash_document", {
    p_cash_document_id: parsed.data.cashDocumentId,
    p_action: parsed.data.action,
    p_note: parsed.data.note || null,
  });
  if (error) {
    console.error("reverseCashDocumentAction failed", error.code);
    cashDocumentRedirect({ error: "红冲操作失败，单据或往来余额可能已变化" });
  }

  const result = data as { documentNo?: string; reversalStatus?: string } | null;
  revalidatePath("/finance");
  revalidatePath("/finance/cash-documents");
  cashDocumentRedirect({
    updated: result?.documentNo ?? "红冲操作成功",
    status: result?.reversalStatus ?? "reversal-updated",
  });
}
