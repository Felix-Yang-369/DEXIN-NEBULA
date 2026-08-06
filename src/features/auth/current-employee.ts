import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

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

  const { data: roleRows } = await supabase
    .from("employee_roles")
    .select("roles(code)")
    .eq("employee_id", employee.id);

  const roleCodes = (roleRows ?? [])
    .map((row) => {
      const role = Array.isArray(row.roles) ? row.roles[0] : row.roles;
      return role?.code;
    })
    .filter((code): code is string => Boolean(code));

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
    roleCodes,
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
