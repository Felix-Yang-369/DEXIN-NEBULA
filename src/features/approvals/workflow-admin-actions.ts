"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import { createClient } from "@/lib/supabase/server";

export async function configureApprovalWorkflowNodeAction(formData: FormData) {
  await requireCurrentEmployee();
  const optionalAmount = z.preprocess((value) => value === "" ? null : value, z.coerce.number().nonnegative().max(100_000_000).nullable());
  const parsed = z.object({ nodeId: z.uuid(), minAmount: optionalAmount, maxAmount: optionalAmount, slaHours: z.coerce.number().int().min(1).max(720) }).safeParse({ nodeId: formData.get("nodeId"), minAmount: formData.get("minAmount"), maxAmount: formData.get("maxAmount"), slaHours: formData.get("slaHours") });
  if (!parsed.success || (parsed.data.maxAmount !== null && parsed.data.minAmount !== null && parsed.data.maxAmount < parsed.data.minAmount)) redirect("/system/approvals?error=invalid");
  const supabase = await createClient();
  const { error } = await supabase.rpc("configure_approval_workflow_node", { p_node_id: parsed.data.nodeId, p_is_enabled: formData.get("isEnabled") === "on", p_min_amount: parsed.data.minAmount, p_max_amount: parsed.data.maxAmount, p_sla_hours: parsed.data.slaHours });
  if (error) redirect(`/system/approvals?error=${error.message.includes("权限") ? "forbidden" : "failed"}`);
  revalidatePath("/system/approvals"); revalidatePath("/audit");
  redirect("/system/approvals?saved=1");
}
