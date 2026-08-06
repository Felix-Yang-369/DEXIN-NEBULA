"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import { createClient } from "@/lib/supabase/server";

export type LeaveSubmissionState = {
  error: string;
};

const leaveSubmissionSchema = z
  .object({
    leaveType: z.enum([
      "welfare",
      "sick",
      "personal",
      "marriage",
      "bereavement",
      "maternity",
      "paternity",
      "work_injury",
      "other",
    ]),
    startDate: z.iso.date("请选择有效的开始日期"),
    endDate: z.iso.date("请选择有效的结束日期"),
    reason: z.string().trim().min(5, "请假事由至少填写 5 个字"),
    handover: z.string().trim().min(2, "请填写工作交接安排"),
    isEmergency: z.boolean(),
    emergencyNote: z.string().trim(),
  })
  .superRefine((value, context) => {
    if (value.endDate < value.startDate) {
      context.addIssue({
        code: "custom",
        message: "结束日期不能早于开始日期",
        path: ["endDate"],
      });
    }

    if (value.isEmergency && value.emergencyNote.length < 5) {
      context.addIssue({
        code: "custom",
        message: "请说明紧急情况和通知直属主管的方式",
        path: ["emergencyNote"],
      });
    }
  });

function safeWorkflowMessage(message?: string) {
  const knownMessages = [
    "当前账号未绑定在职员工档案",
    "员工尚未设置直属负责人，不能提交请假",
    "直属负责人无效或已停用",
    "下一审批节点尚未配置负责人",
    "申请已被其他人处理，请刷新后重试",
    "该待办未分配给当前用户",
  ];

  return (
    knownMessages.find((known) => message?.includes(known)) ??
    "操作未完成，请刷新页面后重试或联系系统管理员。"
  );
}

export async function submitLeaveRequestAction(
  _previousState: LeaveSubmissionState,
  formData: FormData,
): Promise<LeaveSubmissionState> {
  await requireCurrentEmployee();

  const parsed = leaveSubmissionSchema.safeParse({
    leaveType: formData.get("leaveType"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    reason: formData.get("reason"),
    handover: formData.get("handover"),
    isEmergency: formData.get("isEmergency") === "on",
    emergencyNote: formData.get("emergencyNote") ?? "",
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "请检查申请内容",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_leave_request", {
    p_leave_type: parsed.data.leaveType,
    p_start_date: parsed.data.startDate,
    p_end_date: parsed.data.endDate,
    p_reason: parsed.data.reason,
    p_handover: parsed.data.handover,
    p_is_emergency: parsed.data.isEmergency,
    p_emergency_note: parsed.data.emergencyNote,
  });

  if (error) {
    return { error: safeWorkflowMessage(error.message) };
  }

  revalidatePath("/approvals");
  redirect("/approvals?created=1");
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

export async function processLeaveRequestAction(formData: FormData) {
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
  const { error } = await supabase.rpc("process_leave_request", {
    p_request_id: parsed.data.requestId,
    p_action: parsed.data.workflowAction,
    p_opinion: parsed.data.opinion,
    p_expected_version: parsed.data.version,
  });

  if (error) {
    const message = safeWorkflowMessage(error.message);
    const errorCode = message.includes("其他人处理")
      ? "version_conflict"
      : message.includes("未分配")
        ? "forbidden"
        : "process_failed";
    redirect(`/approvals?error=${errorCode}`);
  }

  revalidatePath("/approvals");
  revalidatePath("/dashboard");
  redirect("/approvals?updated=1");
}
