"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import { createClient } from "@/lib/supabase/server";

function ensureAdmin(roleCodes: string[]) {
  if (!roleCodes.includes("admin")) redirect("/system/data-quality?error=forbidden");
}

export async function refreshDataQualityAction() {
  const employee = await requireCurrentEmployee();
  ensureAdmin(employee.roleCodes);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("refresh_master_data_quality_issues");
  if (error) redirect("/system/data-quality?error=scan_failed");
  revalidatePath("/system/data-quality");
  redirect(`/system/data-quality?scanned=${Number(data ?? 0)}`);
}

export async function updateDataQualityIssueAction(formData: FormData) {
  const employee = await requireCurrentEmployee();
  ensureAdmin(employee.roleCodes);
  const parsed = z.object({
    issueId: z.uuid(),
    status: z.enum(["open", "resolved", "ignored"]),
    assigneeId: z.union([z.uuid(), z.literal("")]),
    note: z.string().trim().max(300),
  }).safeParse({
    issueId: formData.get("issueId"),
    status: formData.get("status"),
    assigneeId: formData.get("assigneeId") ?? "",
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) redirect("/system/data-quality?error=invalid_issue");
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_master_data_quality_issue", {
    p_issue_id: parsed.data.issueId,
    p_status: parsed.data.status,
    p_assigned_to_employee_id: parsed.data.assigneeId || null,
    p_resolution_note: parsed.data.note || null,
  });
  if (error) redirect("/system/data-quality?error=update_failed");
  revalidatePath("/system/data-quality");
  redirect("/system/data-quality?updated=1");
}
