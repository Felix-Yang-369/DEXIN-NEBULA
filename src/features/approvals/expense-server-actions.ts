"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import { createClient } from "@/lib/supabase/server";

export type ExpenseSubmissionState = {
  error: string;
};

const expenseSubmissionSchema = z.object({
  expenseCategory: z.enum([
    "travel",
    "transport",
    "hospitality",
    "office",
    "purchase",
    "other",
  ]),
  occurredOn: z.iso.date("请选择有效的费用发生日期"),
  amount: z.coerce
    .number()
    .positive("报销金额必须大于 0")
    .max(1_000_000, "单笔报销金额不能超过 100 万元"),
  vendor: z.string().trim().max(100, "收款方名称不能超过 100 个字"),
  description: z.string().trim().min(5, "费用说明至少填写 5 个字").max(500),
  hasInvoice: z.boolean(),
  invoiceCount: z.coerce.number().int().min(0).max(100),
});

function safeExpenseMessage(message?: string) {
  const knownMessages = [
    "当前账号未绑定在职员工档案",
    "员工尚未设置直属负责人，不能提交报销",
    "直属负责人无效或已停用",
    "尚未配置有效财务审批人",
    "大额报销尚未配置董事长审批人",
    "费用发生日期无效",
    "报销金额无效",
    "费用说明至少填写 5 个字",
    "请填写发票张数",
    "申请已被其他人处理，请刷新后重试",
    "该待办未分配给当前用户",
  ];

  return (
    knownMessages.find((known) => message?.includes(known)) ??
    "操作未完成，请刷新页面后重试或联系系统管理员。"
  );
}

export async function submitExpenseClaimAction(
  _previousState: ExpenseSubmissionState,
  formData: FormData,
): Promise<ExpenseSubmissionState> {
  await requireCurrentEmployee();

  const parsed = expenseSubmissionSchema.safeParse({
    expenseCategory: formData.get("expenseCategory"),
    occurredOn: formData.get("occurredOn"),
    amount: formData.get("amount"),
    vendor: formData.get("vendor") ?? "",
    description: formData.get("description"),
    hasInvoice: formData.get("hasInvoice") === "on",
    invoiceCount: formData.get("invoiceCount") || 0,
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "请检查报销申请内容",
    };
  }

  if (
    parsed.data.occurredOn >
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date())
  ) {
    return { error: "费用发生日期不能晚于今天" };
  }

  if (parsed.data.hasInvoice && parsed.data.invoiceCount === 0) {
    return { error: "已选择有发票，请填写发票张数" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_expense_claim", {
    p_expense_category: parsed.data.expenseCategory,
    p_occurred_on: parsed.data.occurredOn,
    p_amount: parsed.data.amount,
    p_vendor: parsed.data.vendor,
    p_description: parsed.data.description,
    p_has_invoice: parsed.data.hasInvoice,
    p_invoice_count: parsed.data.invoiceCount,
  });

  if (error) {
    return { error: safeExpenseMessage(error.message) };
  }

  revalidatePath("/approvals");
  revalidatePath("/dashboard");
  redirect("/approvals?expenseCreated=1");
}

const processSchema = z.object({
  requestId: z.uuid(),
  version: z.coerce.number().int().positive(),
  workflowAction: z.enum([
    "approve",
    "return",
    "reject",
    "withdraw",
    "resubmit",
  ]),
  opinion: z.string().trim().max(500).default(""),
});

export async function processExpenseApprovalAction(formData: FormData) {
  await requireCurrentEmployee();

  const parsed = processSchema.safeParse({
    requestId: formData.get("requestId"),
    version: formData.get("version"),
    workflowAction: formData.get("workflowAction"),
    opinion: formData.get("opinion") ?? "",
  });

  if (!parsed.success) {
    redirect("/approvals?error=invalid_action");
  }

  if (
    ["return", "reject"].includes(parsed.data.workflowAction) &&
    parsed.data.opinion.length === 0
  ) {
    redirect("/approvals?error=opinion_required");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("process_approval_request", {
    p_request_id: parsed.data.requestId,
    p_action: parsed.data.workflowAction,
    p_opinion: parsed.data.opinion,
    p_expected_version: parsed.data.version,
  });

  if (error) {
    const message = safeExpenseMessage(error.message);
    const errorCode = message.includes("其他人处理")
      ? "version_conflict"
      : message.includes("未分配")
        ? "forbidden"
        : "process_failed";
    redirect(`/approvals?error=${errorCode}`);
  }

  revalidatePath("/approvals");
  revalidatePath("/dashboard");
  redirect("/approvals?expenseUpdated=1");
}
