"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import { createClient } from "@/lib/supabase/server";

export type WeeklyReportActionState = {
  error: string;
};

const weeklyReportSchema = z.object({
  weekStart: z.iso.date("请选择有效的周报周期"),
  completedWork: z.string().trim().min(2, "请填写本周完成工作").max(5000),
  ongoingWork: z.string().trim().min(2, "请填写当前推进事项").max(5000),
  blockers: z.string().trim().min(2, "请填写存在的问题；如无请填写“暂无”").max(5000),
  nextWeekPlan: z.string().trim().min(2, "请填写下周工作计划").max(5000),
  intent: z.enum(["draft", "submit"]),
});

function safeWeeklyReportMessage(message?: string) {
  const knownMessages = [
    "当前账号未绑定在职员工档案",
    "周报周期必须从周一开始",
    "不能填写未来周期的周报",
    "仅支持补录最近十二周的周报",
    "周报四个模块均需填写",
    "周报单个模块不能超过五千字",
    "员工尚未设置直属负责人，不能提交周报",
    "该周报已经提交，不能再次修改",
  ];

  return (
    knownMessages.find((known) => message?.includes(known)) ??
    "周报保存失败，请刷新后重试或联系系统管理员。"
  );
}

export async function saveWeeklyReportAction(
  _previousState: WeeklyReportActionState,
  formData: FormData,
): Promise<WeeklyReportActionState> {
  await requireCurrentEmployee();

  const parsed = weeklyReportSchema.safeParse({
    weekStart: formData.get("weekStart"),
    completedWork: formData.get("completedWork"),
    ongoingWork: formData.get("ongoingWork"),
    blockers: formData.get("blockers"),
    nextWeekPlan: formData.get("nextWeekPlan"),
    intent: formData.get("intent"),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "请检查周报内容",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_weekly_report", {
    p_week_start: parsed.data.weekStart,
    p_completed_work: parsed.data.completedWork,
    p_ongoing_work: parsed.data.ongoingWork,
    p_blockers: parsed.data.blockers,
    p_next_week_plan: parsed.data.nextWeekPlan,
    p_submit: parsed.data.intent === "submit",
  });

  if (error) {
    return { error: safeWeeklyReportMessage(error.message) };
  }

  revalidatePath("/reports/weekly");
  revalidatePath("/dashboard");
  revalidatePath("/notifications");
  redirect(
    `/reports/weekly?week=${parsed.data.weekStart}&saved=${parsed.data.intent}`,
  );
}
