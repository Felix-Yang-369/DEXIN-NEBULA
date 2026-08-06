"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import { createClient } from "@/lib/supabase/server";

const grantSchema = z.object({
  employeeId: z.uuid(),
  roleCode: z.enum(["department_lead", "hr", "finance"]),
  durationHours: z.coerce.number().int().min(1).max(720),
  reason: z.string().trim().min(5).max(200),
});

function temporaryGrantError(message?: string) {
  if (message?.includes("只有系统管理员")) return "forbidden";
  if (message?.includes("永久拥有")) return "permanent_role";
  if (message?.includes("未到期")) return "duplicate_grant";
  if (message?.includes("不支持")) return "forbidden_role";
  if (message?.includes("目标员工")) return "invalid_employee";
  if (message?.includes("原因")) return "invalid_reason";
  return "operation_failed";
}

export async function grantTemporaryRoleAction(formData: FormData) {
  await requireCurrentEmployee();
  const parsed = grantSchema.safeParse({
    employeeId: formData.get("employeeId"),
    roleCode: formData.get("roleCode"),
    durationHours: formData.get("durationHours"),
    reason: formData.get("reason"),
  });

  if (!parsed.success) {
    redirect("/roles?temporaryError=invalid_input#temporary-grants");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("grant_temporary_role", {
    p_employee_id: parsed.data.employeeId,
    p_role_code: parsed.data.roleCode,
    p_duration_hours: parsed.data.durationHours,
    p_reason: parsed.data.reason,
  });

  if (error) {
    redirect(
      `/roles?temporaryError=${temporaryGrantError(error.message)}#temporary-grants`,
    );
  }

  revalidatePath("/roles");
  revalidatePath("/audit");
  redirect("/roles?temporarySaved=1#temporary-grants");
}

const revokeSchema = z.object({
  grantId: z.uuid(),
  reason: z.string().trim().min(5).max(200),
});

export async function revokeTemporaryRoleAction(formData: FormData) {
  await requireCurrentEmployee();
  const parsed = revokeSchema.safeParse({
    grantId: formData.get("grantId"),
    reason: formData.get("reason"),
  });

  if (!parsed.success) {
    redirect("/roles?temporaryError=invalid_reason#temporary-grants");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_temporary_role", {
    p_grant_id: parsed.data.grantId,
    p_reason: parsed.data.reason,
  });

  if (error) {
    redirect(
      `/roles?temporaryError=${temporaryGrantError(error.message)}#temporary-grants`,
    );
  }

  revalidatePath("/roles");
  revalidatePath("/audit");
  redirect("/roles?temporaryRevoked=1#temporary-grants");
}
