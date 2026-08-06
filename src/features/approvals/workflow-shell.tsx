import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronDown, CircleHelp, Search } from "lucide-react";
import { NebulaLogo } from "@/components/brand/nebula-logo";
import { EmployeeAvatar } from "@/components/business/employee-avatar";
import { SidebarIcon } from "@/components/icons/sidebar-icons";
import {
  isPlatformItemActive,
  platformNavigationGroups,
} from "@/config/platform-navigation";
import { getCurrentEmployeeAvatarUrl } from "@/features/auth/current-employee";

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
  const avatarUrl = currentUser ? await getCurrentEmployeeAvatarUrl() : null;

  return (
    <div className="min-h-svh bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[252px] flex-col overflow-hidden border-r border-white/10 bg-[radial-gradient(circle_at_10%_0%,rgba(24,175,179,.24),transparent_29%),linear-gradient(180deg,#0a2b4b_0%,#0a2340_58%,#06182c_100%)] px-3.5 py-4 text-white shadow-[12px_0_36px_rgba(6,24,44,.12)] print:hidden lg:flex">
        <div className="border-b border-white/[0.08] px-2.5 pb-5 pt-1">
          <NebulaLogo inverse />
        </div>
        <nav className="mt-4 flex-1 overflow-y-auto pb-4">
          {platformNavigationGroups.map((group) => (
            <div className="mb-4" key={group.label}>
              <div className="mb-1.5 flex items-center justify-between px-3 text-[9px] font-semibold tracking-[0.16em] text-[#79d8d5]/48">
                <span>{group.label}</span>
                {group.english ? (
                  <span className="text-[7px] tracking-[0.14em] text-white/18">
                    {group.english}
                  </span>
                ) : null}
              </div>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const isActive = isPlatformItemActive(item, activeItem);
                  const hasChildren = Boolean(item.children?.length);

                  if (hasChildren) {
                    return (
                      <details
                        className="group/nav"
                        key={item.label}
                        open={isActive}
                      >
                        <summary
                          className={`relative flex h-10 cursor-pointer list-none items-center gap-3 overflow-hidden rounded-[13px] px-3 text-[13px] transition-all duration-200 [&::-webkit-details-marker]:hidden ${
                            isActive
                              ? "bg-[linear-gradient(90deg,rgba(24,175,179,.22),rgba(255,255,255,.08))] text-white shadow-[inset_0_0_0_1px_rgba(107,215,212,.16),0_8px_20px_rgba(0,0,0,.1)]"
                              : "text-white/58 hover:translate-x-0.5 hover:bg-white/[0.07] hover:text-white"
                          }`}
                        >
                          {isActive && (
                            <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-[#e1a72d]" />
                          )}
                          <span
                            className={`grid size-7 place-items-center rounded-[9px] ${
                              isActive
                                ? "bg-[#6bd7d4] text-[#071d34]"
                                : "bg-white/[0.055] text-white/64"
                            }`}
                          >
                            <SidebarIcon name={item.icon} />
                          </span>
                          <span>{item.label}</span>
                          <ChevronDown className="ml-auto size-3.5 text-white/35 transition-transform group-open/nav:rotate-180" />
                        </summary>
                        <div className="ml-6 mt-1 space-y-0.5 border-l border-white/10 pb-1 pl-3">
                          {item.children?.map((child) => {
                            const childActive =
                              isActive &&
                              Boolean(
                                child.activeMatch &&
                                  breadcrumb.includes(child.activeMatch),
                              );
                            return (
                              <Link
                                className={`block rounded-lg px-3 py-2 text-[11px] transition ${
                                  childActive
                                    ? "bg-white/[0.09] font-medium text-[#8ce2df]"
                                    : "text-white/40 hover:bg-white/[0.055] hover:text-white/75"
                                }`}
                                href={child.href}
                                key={`${item.label}-${child.label}`}
                              >
                                {child.label}
                              </Link>
                            );
                          })}
                        </div>
                      </details>
                    );
                  }

                  return (
                    <Link
                      className={`group relative flex h-10 items-center gap-3 overflow-hidden rounded-[13px] px-3 text-[13px] transition-all duration-200 ${
                        isActive
                          ? "bg-[linear-gradient(90deg,rgba(24,175,179,.22),rgba(255,255,255,.08))] text-white shadow-[inset_0_0_0_1px_rgba(107,215,212,.16),0_8px_20px_rgba(0,0,0,.1)]"
                          : "text-white/58 hover:translate-x-0.5 hover:bg-white/[0.07] hover:text-white"
                      }`}
                      href={item.href}
                      key={item.label}
                    >
                      {isActive && (
                        <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-[#e1a72d]" />
                      )}
                      <span
                        className={`grid size-7 place-items-center rounded-[9px] transition-all duration-200 ${
                          isActive
                            ? "bg-[#6bd7d4] text-[#071d34] shadow-[0_5px_14px_rgba(24,175,179,.22)]"
                            : "bg-white/[0.055] text-white/64 group-hover:bg-white/10 group-hover:text-white/90"
                        }`}
                      >
                        <SidebarIcon name={item.icon} />
                      </span>
                      <span>{item.label}</span>
                      {item.badge && (
                        <span className="ml-auto rounded-full bg-white/8 px-2 py-0.5 text-[10px] text-white/42">
                          {item.badge}
                        </span>
                      )}
                      {item.future && (
                        <span className="ml-auto text-[9px] text-white/25">
                          规划
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
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
