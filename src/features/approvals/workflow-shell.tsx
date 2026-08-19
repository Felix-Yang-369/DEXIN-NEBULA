import type { ReactNode } from "react";
import Link from "next/link";
import { CircleHelp, Search } from "lucide-react";
import { NebulaLogo } from "@/components/brand/nebula-logo";
import { EmployeeAvatar } from "@/components/business/employee-avatar";
import { PlatformNavigationList } from "@/components/navigation/platform-navigation-list";
import {
  navigationGroupsForRoles,
  splitNavigationGroups,
} from "@/config/platform-navigation";
import {
  getCurrentEmployee,
  getCurrentEmployeeAvatarUrl,
} from "@/features/auth/current-employee";

export async function WorkflowShell({
  breadcrumb,
  children,
  currentUser,
  activeItem = "协同办公",
}: {
  breadcrumb: string;
  children: ReactNode;
  currentUser?: {
    name: string;
    roleLabel: string;
  };
  activeItem?: string;
}) {
  const displayName = currentUser?.name ?? "系统管理员";
  const roleLabel = currentUser?.roleLabel ?? "德馨淼盛";
  const employee = await getCurrentEmployee();
  const avatarUrl = currentUser ? await getCurrentEmployeeAvatarUrl() : null;
  const navigationGroups = navigationGroupsForRoles(employee?.roleCodes ?? []);
  const { mainGroups, bottomGroups } = splitNavigationGroups(navigationGroups);

  return (
    <div className="min-h-svh bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[252px] flex-col overflow-hidden border-r border-white/10 bg-[radial-gradient(circle_at_10%_0%,rgba(24,175,179,.24),transparent_29%),linear-gradient(180deg,#0a2b4b_0%,#0a2340_58%,#06182c_100%)] px-3.5 py-4 text-white shadow-[12px_0_36px_rgba(6,24,44,.12)] print:hidden lg:flex">
        <div className="border-b border-white/[0.08] px-2.5 pb-5 pt-1">
          <NebulaLogo inverse />
        </div>
        <nav className="mt-4 min-h-0 flex-1 overflow-y-auto pb-3">
          <PlatformNavigationList
            activeItem={activeItem}
            breadcrumb={breadcrumb}
            groups={mainGroups}
          />
        </nav>
        {bottomGroups.length ? (
          <nav className="shrink-0 border-t border-white/10 pt-3">
            <PlatformNavigationList
              activeItem={activeItem}
              breadcrumb={breadcrumb}
              groups={bottomGroups}
            />
          </nav>
        ) : null}
        <div className="mb-0.5 rounded-[18px] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,.085),rgba(255,255,255,.035))] p-3.5 shadow-[0_12px_32px_rgba(0,0,0,.1)]">
          <div className="flex items-center gap-3">
            <EmployeeAvatar name={displayName} size="sm" src={avatarUrl} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium">{displayName}</div>
              <div className="mt-0.5 truncate text-[10px] text-white/38">
                {roleLabel}
              </div>
            </div>
          </div>
        </div>
      </aside>

      <div className="print:pl-0 lg:pl-[252px]">
        <header className="sticky top-0 z-20 flex h-[72px] items-center border-b border-border/80 bg-white/88 px-4 backdrop-blur-xl print:hidden sm:px-6 xl:px-8">
          <div className="lg:hidden">
            <NebulaLogo compact />
          </div>
          <div className="ml-3 hidden text-xs text-muted-foreground md:block lg:ml-0">
            德馨星云 / {breadcrumb}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Link
              aria-label="打开全局搜索"
              className="grid size-9 place-items-center rounded-xl border border-border bg-white text-muted-foreground md:hidden"
              href="/search"
            >
              <Search className="size-4" />
            </Link>
            <form
              action="/search"
              className="relative hidden md:block"
              method="get"
            >
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/60" />
              <input
                aria-label="全局搜索"
                className="h-9 w-52 rounded-xl border border-border bg-[#f3f7fa] pl-9 pr-3 text-[10px] outline-none transition-all placeholder:text-muted-foreground/55 focus:w-64 focus:border-primary/35 focus:bg-white focus:ring-4 focus:ring-primary/7 xl:w-64"
                name="q"
                placeholder="搜索员工、制度、产品…"
                type="search"
              />
            </form>
            <Link
              aria-label="打开使用指南"
              className="grid size-9 place-items-center rounded-xl border border-border bg-white text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              href="/help"
            >
              <CircleHelp className="size-4" />
            </Link>
            <Link
              aria-label="进入账号信息管理"
              className="rounded-full transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              href="/account"
            >
              <EmployeeAvatar name={displayName} size="sm" src={avatarUrl} />
            </Link>
            {currentUser && (
              <form action="/auth/signout" method="post">
                <button
                  className="h-8 rounded-xl border border-border bg-white px-3 text-[10px] text-muted-foreground transition-colors hover:bg-muted"
                  type="submit"
                >
                  退出
                </button>
              </form>
            )}
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
