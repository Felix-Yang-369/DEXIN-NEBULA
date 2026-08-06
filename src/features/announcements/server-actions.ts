"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import { createClient } from "@/lib/supabase/server";

export type AnnouncementActionState = {
  error: string;
};

const announcementSchema = z
  .object({
    announcementId: z.union([z.literal(""), z.uuid()]),
    title: z.string().trim().min(4, "公告标题至少填写 4 个字").max(120),
    summary: z.string().trim().min(8, "公告摘要至少填写 8 个字").max(300),
    content: z.string().trim().min(10, "公告正文至少填写 10 个字").max(20000),
    categoryCode: z.enum(["company", "policy", "project", "operations"]),
    scopeType: z.enum(["all", "department"]),
    scopeDepartmentId: z.union([z.literal(""), z.uuid()]),
    isPinned: z.boolean(),
    intent: z.enum(["draft", "publish"]),
  })
  .superRefine((value, context) => {
    if (value.scopeType === "department" && !value.scopeDepartmentId) {
      context.addIssue({
        code: "custom",
        message: "请选择公告可见部门",
        path: ["scopeDepartmentId"],
      });
    }
  });

function safeAnnouncementMessage(message?: string) {
  const knownMessages = [
    "当前账号没有公告发布权限",
    "公告标题需为四至一百二十个字",
    "公告摘要需为八至三百个字",
    "公告正文需为十至两万个字",
    "公告分类无效",
    "公告范围无效",
    "请选择当前组织的有效部门",
    "公告不存在",
    "只有草稿可以编辑或发布",
  ];
  return (
    knownMessages.find((known) => message?.includes(known)) ??
    "公告保存失败，请刷新后重试或联系系统管理员。"
  );
}

export async function saveAnnouncementAction(
  _previousState: AnnouncementActionState,
  formData: FormData,
): Promise<AnnouncementActionState> {
  await requireCurrentEmployee();

  const parsed = announcementSchema.safeParse({
    announcementId: formData.get("announcementId") ?? "",
    title: formData.get("title"),
    summary: formData.get("summary"),
    content: formData.get("content"),
    categoryCode: formData.get("categoryCode"),
    scopeType: formData.get("scopeType"),
    scopeDepartmentId: formData.get("scopeDepartmentId") ?? "",
    isPinned: formData.get("isPinned") === "on",
    intent: formData.get("intent"),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "请检查公告内容",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_announcement", {
    p_announcement_id: parsed.data.announcementId || null,
    p_title: parsed.data.title,
    p_summary: parsed.data.summary,
    p_content: parsed.data.content,
    p_category_code: parsed.data.categoryCode,
    p_scope_type: parsed.data.scopeType,
    p_scope_department_id: parsed.data.scopeDepartmentId || null,
    p_is_pinned: parsed.data.isPinned,
    p_publish: parsed.data.intent === "publish",
  });

  if (error) {
    return { error: safeAnnouncementMessage(error.message) };
  }

  revalidatePath("/announcements");
  revalidatePath("/dashboard");
  revalidatePath("/notifications");

  if (parsed.data.intent === "publish") {
    redirect(`/announcements/${data}?published=1`);
  }
  redirect(`/announcements/new?edit=${data}&saved=draft`);
}

export async function markAnnouncementReadAction(announcementId: string) {
  await requireCurrentEmployee();
  const parsed = z.uuid().safeParse(announcementId);
  if (!parsed.success) return;

  const supabase = await createClient();
  await supabase.rpc("mark_announcement_read", {
    p_announcement_id: parsed.data,
  });
  revalidatePath("/announcements");
}
