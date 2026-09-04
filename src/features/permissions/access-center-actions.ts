"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import { createClient } from "@/lib/supabase/server";

const roleSchema = z.object({
  code: z.string().trim().toLowerCase().regex(/^[a-z][a-z0-9_]{2,39}$/),
  name: z.string().trim().min(2).max(40),
  description: z.string().trim().max(200),
});

const scopeValues = ["self", "department", "department_tree", "assigned", "organization"] as const;
const fieldValues = ["masked", "read", "full"] as const;

function ensureAdministrator(roleCodes: string[]) {
  if (!roleCodes.some((code) => code === "admin" || code === "chairman")) {
    redirect("/system/permissions?error=forbidden");
  }
}

export async function createAccessRoleAction(formData: FormData) {
  const employee = await requireCurrentEmployee();
  ensureAdministrator(employee.roleCodes);
  const parsed = roleSchema.safeParse({
    code: formData.get("code"),
    name: formData.get("name"),
    description: formData.get("description") ?? "",
  });
  if (!parsed.success) redirect("/system/permissions?error=invalid_role");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_access_role", {
    p_code: parsed.data.code,
    p_name: parsed.data.name,
    p_description: parsed.data.description || null,
  });
  if (error) {
    redirect(`/system/permissions?error=${error.code === "23505" ? "duplicate_role" : "role_failed"}`);
  }
  revalidatePath("/system/permissions");
  revalidatePath("/audit");
  redirect(`/system/permissions?role=${String(data)}&saved=role#role-editor`);
}

export async function configureAccessRoleAction(formData: FormData) {
  const employee = await requireCurrentEmployee();
  ensureAdministrator(employee.roleCodes);
  const roleId = z.uuid().safeParse(formData.get("roleId"));
  if (!roleId.success) redirect("/system/permissions?error=invalid_role#role-editor");

  const permissionCodes = formData.getAll("permissionCodes").map(String);
  const grants = permissionCodes.map((code) => {
    const scope = z.enum(scopeValues).catch("organization").parse(formData.get(`scope:${code}`));
    const fieldAccess = z.enum(fieldValues).catch("full").parse(formData.get(`field:${code}`));
    const effect = formData.get(`effect:${code}`) === "deny" ? "deny" : "allow";
    return { code, effect, data_scope: scope, field_access: fieldAccess };
  });

  const supabase = await createClient();
  const { error } = await supabase.rpc("configure_access_role", {
    p_role_id: roleId.data,
    p_grants: grants,
  });
  if (error) redirect(`/system/permissions?role=${roleId.data}&error=grant_failed#role-editor`);

  revalidatePath("/system/permissions");
  revalidatePath("/audit");
  redirect(`/system/permissions?role=${roleId.data}&saved=permissions#role-editor`);
}

export async function assignAccessRoleAction(formData: FormData) {
  const employee = await requireCurrentEmployee();
  ensureAdministrator(employee.roleCodes);
  const parsed = z.object({
    employeeId: z.uuid(),
    roleId: z.uuid(),
    assigned: z.enum(["true", "false"]),
  }).safeParse({
    employeeId: formData.get("employeeId"),
    roleId: formData.get("roleId"),
    assigned: formData.get("assigned"),
  });
  if (!parsed.success) redirect("/system/permissions?error=invalid_assignment#assignments");

  const supabase = await createClient();
  const { error } = await supabase.rpc("assign_access_role", {
    p_employee_id: parsed.data.employeeId,
    p_role_id: parsed.data.roleId,
    p_assigned: parsed.data.assigned === "true",
  });
  if (error) redirect("/system/permissions?error=assignment_failed#assignments");

  revalidatePath("/system/permissions");
  revalidatePath("/audit");
  redirect(`/system/permissions?employee=${parsed.data.employeeId}&saved=assignment#effective-access`);
}
