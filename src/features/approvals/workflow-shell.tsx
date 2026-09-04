import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { AppShellClient, type SidebarMode } from "@/components/navigation/app-shell-client";
import {
  navigationGroupsForRoles,
  splitNavigationGroups,
} from "@/config/platform-navigation";
import {
  getCurrentEmployee,
  getCurrentEmployeeAvatarUrl,
} from "@/features/auth/current-employee";
import { createClient } from "@/lib/supabase/server";

export async function WorkflowShell({
  breadcrumb,
  children,
  currentUser,
  activeItem = "协同办公",
}: {
  breadcrumb: string;
  children: ReactNode;
  currentUser?: { name: string; roleLabel: string };
  activeItem?: string;
}) {
  const employee = await getCurrentEmployee();
  const displayName = currentUser?.name ?? employee?.name ?? "系统管理员";
  const roleLabel = currentUser?.roleLabel ?? employee?.title ?? "德馨淼盛";
  const supabase = await createClient();
  const cookieStore = await cookies();

  const [avatarUrl, shellContextResult] = await Promise.all([
    getCurrentEmployeeAvatarUrl(),
    employee ? supabase.rpc("current_shell_context") : Promise.resolve({ data: null }),
  ]);
  const shellContext = (shellContextResult.data ?? {}) as {
    sidebarMode?: string;
    density?: string;
    unreadCount?: number;
    pendingCount?: number;
  };
  const pendingCount = Number(shellContext.pendingCount ?? 0);
  const groups = navigationGroupsForRoles(
    employee?.roleCodes ?? [],
    employee?.accessPermissionCodes ?? [],
  ).map((group) => ({
    ...group,
    items: group.items.map((item) =>
      item.href === "/approvals" && pendingCount > 0
        ? { ...item, countBadge: pendingCount }
        : item,
    ),
  }));
  const { mainGroups, bottomGroups } = splitNavigationGroups(groups);
  const savedMode = shellContext.sidebarMode;
  const sidebarMode: SidebarMode = savedMode === "compact" ? "compact" : "expanded";

  return (
    <AppShellClient
      activeItem={activeItem}
      avatarUrl={avatarUrl}
      bottomGroups={bottomGroups}
      breadcrumb={breadcrumb}
      displayName={displayName}
      density={shellContext.density === "compact" ? "compact" : "comfortable"}
      hiddenInitially={cookieStore.get("nebula_sidebar_hidden")?.value === "1"}
      mainGroups={mainGroups}
      roleLabel={roleLabel}
      sidebarMode={sidebarMode}
      unreadCount={Number(shellContext.unreadCount ?? 0)}
    >
      {children}
    </AppShellClient>
  );
}
