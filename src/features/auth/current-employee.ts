import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { assignableRoleCodes } from "@/features/permissions/employee-role-assignment";

export type CurrentEmployee = {
  id: string;
  authUserId: string;
  organizationId: string;
  departmentId: string | null;
  managerId: string | null;
  employeeNo: string;
  name: string;
  email: string;
  title: string | null;
  avatarPath: string | null;
  status: "active" | "inactive";
  roleCodes: string[];
  accessPermissionCodes: string[];
};

export const getCurrentEmployee = cache(async (): Promise<CurrentEmployee | null> => {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const supabase = await createClient();
  const { data: verifiedToken } = await supabase.auth.getClaims();
  const authUserId = verifiedToken?.claims.sub;

  if (!authUserId) {
    return null;
  }

  const { data: employee, error } = await supabase
    .from("employees")
    .select(
      "id, auth_user_id, organization_id, department_id, manager_id, employee_no, name, email, title, avatar_path, status",
    )
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (error || !employee || employee.status !== "active") {
    return null;
  }

  const now = new Date().toISOString();
  const [{ data: roleRows }, { data: temporaryRoleRows }] = await Promise.all([
    supabase
      .from("employee_roles")
      .select("roles(code)")
      .eq("employee_id", employee.id),
    supabase
      .from("temporary_role_grants")
      .select("roles(code)")
      .eq("employee_id", employee.id)
      .eq("status", "active")
      .lte("starts_at", now)
      .gt("expires_at", now),
  ]);

  const roleCodes = [...(roleRows ?? []), ...(temporaryRoleRows ?? [])]
    .map((row) => {
      const role = Array.isArray(row.roles) ? row.roles[0] : row.roles;
      return role?.code;
    })
    .filter((code): code is string => Boolean(code));
  const effectiveRoleCodes = roleCodes.includes("chairman")
    ? [...assignableRoleCodes]
    : [...new Set(roleCodes)];
  const { data: permissionRows } = await supabase.rpc(
    "effective_employee_permissions",
    { p_employee_id: employee.id },
  );
  const accessPermissionCodes = (permissionRows ?? [])
    .filter((row: { effect?: string }) => row.effect === "allow")
    .map((row: { permission_code?: string }) => row.permission_code)
    .filter((code: string | undefined): code is string => Boolean(code));

  return {
    id: employee.id,
    authUserId: employee.auth_user_id,
    organizationId: employee.organization_id,
    departmentId: employee.department_id,
    managerId: employee.manager_id,
    employeeNo: employee.employee_no,
    name: employee.name,
    email: employee.email,
    title: employee.title,
    avatarPath: employee.avatar_path,
    status: employee.status,
    roleCodes: effectiveRoleCodes,
    accessPermissionCodes,
  };
});

export const getCurrentEmployeeAvatarUrl = cache(async () => {
  const employee = await getCurrentEmployee();
  if (!employee?.avatarPath) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from("avatars")
    .createSignedUrl(employee.avatarPath, 3600);

  return error ? null : data.signedUrl;
});

export async function requireCurrentEmployee() {
  const employee = await getCurrentEmployee();

  if (!employee) {
    redirect("/login?error=account_unavailable");
  }

  return employee;
}
