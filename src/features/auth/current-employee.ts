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
  departmentCode: string | null;
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

export type AppBootstrap = {
  employee: CurrentEmployee;
  workspace: {
    sidebarMode: "expanded" | "compact";
    density: "comfortable" | "compact";
    defaultWorkspace: "dashboard" | "sales" | "inventory" | "finance" | "oa";
    pinnedModules: string[];
    hiddenWidgets: string[];
  };
  unreadCount: number;
  pendingCount: number;
};

type AppBootstrapPayload = Omit<AppBootstrap, "employee"> & {
  employee: Omit<CurrentEmployee, "roleCodes" | "accessPermissionCodes"> & {
    roleCodes?: string[];
    accessPermissionCodes?: string[];
  };
};

export const getAppBootstrap = cache(async (): Promise<AppBootstrap | null> => {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("current_app_bootstrap");
  const payload = data as AppBootstrapPayload | null;

  if (error || !payload?.employee || payload.employee.status !== "active") {
    return null;
  }

  const roleCodes = payload.employee.roleCodes ?? [];
  const effectiveRoleCodes = roleCodes.includes("chairman")
    ? [...assignableRoleCodes]
    : [...new Set(roleCodes)];

  return {
    ...payload,
    employee: {
      ...payload.employee,
      roleCodes: effectiveRoleCodes,
      accessPermissionCodes: payload.employee.accessPermissionCodes ?? [],
    },
    unreadCount: Number(payload.unreadCount ?? 0),
    pendingCount: Number(payload.pendingCount ?? 0),
  };
});

export const getCurrentEmployee = cache(async (): Promise<CurrentEmployee | null> => {
  const bootstrap = await getAppBootstrap();
  return bootstrap?.employee ?? null;
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
