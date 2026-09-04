"use client";

import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import { startTransition, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Command,
  EyeOff,
  Menu,
  PanelLeftOpen,
  Search,
  X,
} from "lucide-react";
import { NebulaLogo } from "@/components/brand/nebula-logo";
import { EmployeeAvatar } from "@/components/business/employee-avatar";
import { PlatformNavigationList } from "@/components/navigation/platform-navigation-list";
import { CommandCenter } from "@/components/navigation/command-center";
import { desktopOnlyPrefixes, MobileDesktopOnlyNotice, MobileTaskShell } from "@/components/navigation/mobile-task-shell";
import type { PlatformNavigationGroup } from "@/config/platform-navigation";
import { saveSidebarModeAction } from "@/features/workspace/actions";
import { cn } from "@/lib/utils";

export type SidebarMode = "expanded" | "compact";

type AppShellClientProps = {
  activeItem: string;
  avatarUrl: string | null;
  bottomGroups: PlatformNavigationGroup[];
  breadcrumb: string;
  children: ReactNode;
  displayName: string;
  hiddenInitially: boolean;
  mainGroups: PlatformNavigationGroup[];
  roleLabel: string;
  sidebarMode: SidebarMode;
  unreadCount: number;
};

const SIDEBAR_HIDDEN_COOKIE = "nebula_sidebar_hidden";

function setHiddenCookie(hidden: boolean) {
  document.cookie = `${SIDEBAR_HIDDEN_COOKIE}=${hidden ? "1" : "0"}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

function focusableElements(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  );
}

export function AppShellClient({
  activeItem,
  avatarUrl,
  bottomGroups,
  breadcrumb,
  children,
  displayName,
  hiddenInitially,
  mainGroups,
  roleLabel,
  sidebarMode: initialMode,
  unreadCount,
}: AppShellClientProps) {
  const [mode, setMode] = useState<SidebarMode>(initialMode);
  const [hidden, setHidden] = useState(hiddenInitially);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const pathname = usePathname();
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const sidebarWidth = hidden ? "0px" : mode === "compact" ? "64px" : "232px";
  const desktopOnly = desktopOnlyPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

  useEffect(() => {
    const handleShortcut = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "\\") {
        event.preventDefault();
        setHidden((current) => {
          setHiddenCookie(!current);
          return !current;
        });
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  function toggleCompact() {
    const next = mode === "expanded" ? "compact" : "expanded";
    setMode(next);
    if (hidden) {
      setHidden(false);
      setHiddenCookie(false);
    }
    startTransition(() => void saveSidebarModeAction(next));
  }

  function toggleHidden() {
    setHidden((current) => {
      setHiddenCookie(!current);
      return !current;
    });
  }

  function handleDrawerKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      setMobileOpen(false);
      return;
    }
    if (event.key !== "Tab" || !drawerRef.current) return;
    const focusable = focusableElements(drawerRef.current);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  const navigation = (compact: boolean, onNavigate?: () => void) => (
    <>
      <nav
        className={`min-h-0 flex-1 pb-2 ${
          compact ? "mt-2 overflow-visible" : "mt-2 overflow-y-auto overflow-x-hidden"
        }`}
      >
        <PlatformNavigationList
          activeItem={activeItem}
          breadcrumb={breadcrumb}
          compact={compact}
          groups={mainGroups}
          onNavigate={onNavigate}
        />
      </nav>
      {bottomGroups.length ? (
        <nav className="shrink-0 border-t border-white/10 pt-3">
          <PlatformNavigationList
            activeItem={activeItem}
            breadcrumb={breadcrumb}
            compact={compact}
            groups={bottomGroups}
            onNavigate={onNavigate}
          />
        </nav>
      ) : null}
    </>
  );

  return (
    <div
      className="min-h-svh bg-background text-foreground"
      data-ui-system="v3"
      data-sidebar-hidden={hidden}
      data-sidebar-mode={mode}
      data-workspace-density="compact"
      style={{ "--sidebar-width": sidebarWidth } as CSSProperties}
    >
      <aside
        aria-label="主导航"
        className={`fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-white/10 bg-sidebar py-4 text-white transition-[width,transform] duration-200 print:hidden lg:flex ${
          hidden ? "pointer-events-none -translate-x-full" : "translate-x-0"
        } ${mode === "compact" ? "w-16 overflow-visible px-2" : "w-[232px] overflow-hidden px-3"}`}
      >
        <div className={`border-b border-white/[0.08] pb-3 pt-0 ${mode === "compact" ? "px-0" : "px-2"}`}>
          <NebulaLogo compact={mode === "compact"} inverse />
        </div>
        {navigation(mode === "compact")}
        <div className={`mt-2 flex gap-1 border-t border-white/10 pt-3 ${mode === "compact" ? "flex-col" : "items-center"}`}>
          <button
            aria-label={mode === "expanded" ? "收窄侧边栏" : "展开侧边栏"}
            className="grid size-9 place-items-center rounded-md text-white/55 transition hover:bg-white/10 hover:text-white"
            onClick={toggleCompact}
            title={mode === "expanded" ? "收窄侧边栏" : "展开侧边栏"}
            type="button"
          >
            {mode === "expanded" ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />}
          </button>
          <button
            aria-label="隐藏侧边栏"
            className="grid size-9 place-items-center rounded-md text-white/55 transition hover:bg-white/10 hover:text-white"
            onClick={toggleHidden}
            title="隐藏侧边栏（Ctrl/Command + \\）"
            type="button"
          >
            <EyeOff className="size-4" />
          </button>
          <Link
            aria-label="账号信息"
            className={`rounded-md transition hover:bg-white/10 ${mode === "compact" ? "grid size-9 place-items-center" : "ml-auto flex min-w-0 items-center gap-2 px-2 py-1"}`}
            href="/account"
            title={`${displayName} · ${roleLabel}`}
          >
            <EmployeeAvatar name={displayName} size="sm" src={avatarUrl} />
            {mode === "expanded" ? <span className="min-w-0 truncate text-[13px] text-white/65">{displayName}</span> : null}
          </Link>
        </div>
      </aside>

      {hidden ? (
        <button
          aria-label="恢复侧边栏"
          className="fixed left-3 top-20 z-30 hidden size-10 place-items-center rounded-md border border-border bg-white text-primary  transition hover:bg-muted lg:grid print:hidden"
          onClick={toggleHidden}
          title="恢复侧边栏（Ctrl/Command + \\）"
          type="button"
        >
          <PanelLeftOpen className="size-4" />
        </button>
      ) : null}

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="presentation">
          <button
            aria-label="关闭导航"
            className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            type="button"
          />
          <div
            aria-label="移动端主导航"
            aria-modal="true"
            className="absolute inset-y-0 left-0 flex w-[min(88vw,320px)] flex-col overflow-hidden bg-sidebar px-4 py-4 text-white "
            onKeyDown={handleDrawerKeyDown}
            ref={drawerRef}
            role="dialog"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <NebulaLogo inverse />
              <button
                aria-label="关闭导航"
                className="grid size-10 place-items-center rounded-md text-white/65 hover:bg-white/10"
                onClick={() => setMobileOpen(false)}
                ref={closeButtonRef}
                type="button"
              >
                <X className="size-5" />
              </button>
            </div>
            {navigation(false, () => setMobileOpen(false))}
          </div>
        </div>
      ) : null}

      <div className="transition-[padding] duration-200 print:pl-0 lg:pl-[var(--sidebar-width)]">
        <header className="sticky top-0 z-20 flex h-16 items-center border-b border-border bg-white/96 px-4 backdrop-blur-md print:hidden sm:px-6 xl:px-8">
          <button
            aria-expanded={mobileOpen}
            aria-label="打开主导航"
            className="mr-2 grid size-10 place-items-center rounded-md border border-border bg-white text-muted-foreground lg:hidden"
            onClick={() => setMobileOpen(true)}
            type="button"
          >
            <Menu className="size-5" />
          </button>
          <div className="hidden text-xs text-muted-foreground sm:block">
            德馨星云 / {breadcrumb}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              aria-label="打开命令搜索"
              className="grid size-9 place-items-center rounded-md border border-border bg-white text-muted-foreground md:hidden"
              onClick={() => setCommandOpen(true)}
              type="button"
            >
              <Search className="size-4" />
            </button>
            <form action="/search" className="relative hidden md:block" method="get">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/60" />
              <input
                aria-label="全局搜索"
                className="h-9 w-52 rounded-md border border-border bg-muted/60 pl-9 pr-12 text-sm outline-none transition-[width,border-color,box-shadow] placeholder:text-muted-foreground/70 focus:w-64 focus:border-primary/35 focus:bg-white focus:ring-3 focus:ring-primary/10 xl:w-64"
                name="q"
                placeholder="搜索功能、员工、单据编号…"
                type="search"
              />
              <span className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 rounded border border-border bg-white px-1.5 py-0.5 text-xs text-muted-foreground xl:flex">
                <Command className="size-2.5" />K
              </span>
            </form>
            <Link
              aria-label={`查看消息，${unreadCount} 条未读`}
              className="relative grid size-9 place-items-center rounded-md border border-border bg-white text-muted-foreground hover:bg-muted"
              href="/notifications"
            >
              <Bell className="size-4" />
              {unreadCount > 0 ? <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-destructive" /> : null}
            </Link>
            <Link
              aria-label="打开使用指南"
              className="grid size-9 place-items-center rounded-md border border-border bg-white text-muted-foreground hover:bg-muted"
              href="/help"
            >
              <CircleHelp className="size-4" />
            </Link>
            <Link aria-label="进入账号信息管理" className="rounded-md" href="/account">
              <EmployeeAvatar name={displayName} size="sm" src={avatarUrl} />
            </Link>
            <form action="/auth/signout" method="post">
              <button className="hidden h-8 rounded-md border border-border bg-white px-3 text-xs text-muted-foreground hover:bg-muted sm:block" type="submit">
                退出
              </button>
            </form>
          </div>
        </header>
        {desktopOnly ? <MobileDesktopOnlyNotice /> : null}
        <div className={cn(desktopOnly && "hidden lg:block", "pb-20 lg:pb-0")}>{children}</div>
      </div>
      <MobileTaskShell />
      {commandOpen ? <CommandCenter groups={[...mainGroups, ...bottomGroups]} onClose={() => setCommandOpen(false)} /> : null}
    </div>
  );
}
