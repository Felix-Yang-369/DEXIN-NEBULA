"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import { createClient } from "@/lib/supabase/server";

function lifecycleRedirect(params: Record<string, string>): never {
  redirect(`/hr/onboarding?${new URLSearchParams(params).toString()}`);
}

function ensureHrAccess(roleCodes: string[]) {
  if (!roleCodes.some((role) => ["hr", "admin"].includes(role))) {
    lifecycleRedirect({ error: "forbidden" });
  }
}

export async function createEmployeeLifecycleCaseAction(formData: FormData) {
  const currentEmployee = await requireCurrentEmployee();
  ensureHrAccess(currentEmployee.roleCodes);

  const schema = z.object({
    employeeId: z.uuid(),
    processType: z.enum(["onboarding", "offboarding"]),
    effectiveOn: z.iso.date(),
    ownerEmployeeId: z.uuid(),
    note: z.string().trim().max(1000),
  });
  const parsed = schema.safeParse({
    employeeId: formData.get("employeeId"),
    processType: formData.get("processType"),
    effectiveOn: formData.get("effectiveOn"),
    ownerEmployeeId: formData.get("ownerEmployeeId"),
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) lifecycleRedirect({ error: "invalid_case" });

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_employee_lifecycle_case", {
    p_employee_id: parsed.data.employeeId,
    p_process_type: parsed.data.processType,
    p_effective_on: parsed.data.effectiveOn,
    p_owner_employee_id: parsed.data.ownerEmployeeId,
    p_note: parsed.data.note || null,
  });
  if (error) {
    lifecycleRedirect({
      error: error.message.includes("已有进行中")
        ? "active_case_exists"
        : "create_failed",
    });
  }

  revalidatePath("/hr");
  revalidatePath("/hr/onboarding");
  lifecycleRedirect({ created: parsed.data.processType });
}

export async function updateEmployeeLifecycleTaskAction(formData: FormData) {
  const currentEmployee = await requireCurrentEmployee();
  ensureHrAccess(currentEmployee.roleCodes);

  const schema = z.object({
    taskId: z.uuid(),
    action: z.enum(["complete", "skip", "reopen"]),
    note: z.string().trim().max(500),
  });
  const parsed = schema.safeParse({
    taskId: formData.get("taskId"),
    action: formData.get("action"),
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) lifecycleRedirect({ error: "invalid_task" });

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_employee_lifecycle_task", {
    p_task_id: parsed.data.taskId,
    p_action: parsed.data.action,
    p_note: parsed.data.note || null,
  });
  if (error) lifecycleRedirect({ error: "task_failed" });

  revalidatePath("/hr");
  revalidatePath("/hr/onboarding");
  lifecycleRedirect({ updated: "1" });
}

export async function cancelEmployeeLifecycleCaseAction(formData: FormData) {
  const currentEmployee = await requireCurrentEmployee();
  ensureHrAccess(currentEmployee.roleCodes);

  const schema = z.object({
    caseId: z.uuid(),
    reason: z.string().trim().min(2).max(500),
  });
  const parsed = schema.safeParse({
    caseId: formData.get("caseId"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) lifecycleRedirect({ error: "invalid_cancel" });

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_employee_lifecycle_case", {
    p_case_id: parsed.data.caseId,
    p_reason: parsed.data.reason,
  });
  if (error) lifecycleRedirect({ error: "cancel_failed" });

  revalidatePath("/hr");
  revalidatePath("/hr/onboarding");
  lifecycleRedirect({ cancelled: "1" });
}
