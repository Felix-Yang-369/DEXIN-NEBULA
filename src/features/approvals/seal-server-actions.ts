"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import { createClient } from "@/lib/supabase/server";

export type SealSubmissionState = {
  error: string;
};

const sealSubmissionSchema = z
  .object({
    sealType: z.enum([
      "company",
      "contract",
      "finance",
      "legal_representative",
      "other",
    ]),
    useDate: z.iso.date("请选择有效的计划用印日期"),
    documentTitle: z.string().trim().min(2, "文件名称至少填写 2 个字").max(150),
    purpose: z.string().trim().min(5, "用印事由至少填写 5 个字").max(500),
    counterparty: z.string().trim().max(150, "对方单位不能超过 150 个字"),
    copies: z.coerce.number().int().min(1, "用印份数至少为 1").max(100),
    isExternal: z.boolean(),
    expectedReturnOn: z.string().trim(),
    note: z.string().trim().max(500, "备注不能超过 500 个字"),
  })
  .superRefine((data, context) => {
    if (data.isExternal && !z.iso.date().safeParse(data.expectedReturnOn).success) {
      context.addIssue({
        code: "custom",
        message: "印章外带时必须填写预计归还日期",
        path: ["expectedReturnOn"],
      });
    }
    if (
      data.isExternal &&
      data.expectedReturnOn &&
      data.expectedReturnOn < data.useDate
    ) {
      context.addIssue({
        code: "custom",
        message: "预计归还日期不能早于用印日期",
        path: ["expectedReturnOn"],
      });
    }
  });

function safeSealMessage(message?: string) {
  const knownMessages = [
    "当前账号未绑定在职员工档案",
    "员工尚未设置直属负责人，不能提交用印申请",
    "直属负责人无效或已停用",
    "尚未配置行政用印管理员",
    "重要用印尚未配置董事长审批人",
    "印章类型无效",
    "计划用印日期无效",
    "文件名称至少填写 2 个字",
    "用印事由至少填写 5 个字",
    "用印份数无效",
    "印章外带时必须填写预计归还日期",
    "预计归还日期不能早于用印日期",
    "申请已被其他人处理，请刷新后重试",
    "该待办未分配给当前用户",
  ];

  return (
    knownMessages.find((known) => message?.includes(known)) ??
    "操作未完成，请刷新页面后重试或联系系统管理员。"
  );
}

export async function submitSealRequestAction(
  _previousState: SealSubmissionState,
  formData: FormData,
): Promise<SealSubmissionState> {
  await requireCurrentEmployee();

  const parsed = sealSubmissionSchema.safeParse({
    sealType: formData.get("sealType"),
    useDate: formData.get("useDate"),
    documentTitle: formData.get("documentTitle"),
    purpose: formData.get("purpose"),
    counterparty: formData.get("counterparty") ?? "",
    copies: formData.get("copies"),
    isExternal: formData.get("isExternal") === "on",
    expectedReturnOn: formData.get("expectedReturnOn") ?? "",
    note: formData.get("note") ?? "",
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "请检查用印申请内容",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_seal_request_v2", {
    p_seal_type: parsed.data.sealType,
    p_use_date: parsed.data.useDate,
    p_document_title: parsed.data.documentTitle,
    p_purpose: parsed.data.purpose,
    p_counterparty: parsed.data.counterparty,
    p_copies: parsed.data.copies,
    p_is_external: parsed.data.isExternal,
    p_expected_return_on: parsed.data.expectedReturnOn || null,
    p_note: parsed.data.note,
  });

  if (error) {
    return { error: safeSealMessage(error.message) };
  }

  revalidatePath("/approvals");
  revalidatePath("/dashboard");
  redirect("/approvals?sealCreated=1");
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

export async function processSealApprovalAction(formData: FormData) {
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
    const message = safeSealMessage(error.message);
    const errorCode = message.includes("其他人处理")
      ? "version_conflict"
      : message.includes("未分配")
        ? "forbidden"
        : "process_failed";
    redirect(`/approvals?error=${errorCode}`);
  }

  revalidatePath("/approvals");
  revalidatePath("/dashboard");
  redirect("/approvals?sealUpdated=1");
}
