"use client";

import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import { startTransition, useEffect, useRef, useState } from "react";
import Link from "next/link";
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
import type { PlatformNavigationGroup } from "@/config/platform-navigation";
import { saveSidebarModeAction } from "@/features/workspace/actions";

export type SidebarMode = "expanded" | "compact";

type AppShellClientProps = {
  activeItem: string;
  avatarUrl: string | null;
  bottomGroups: PlatformNavigationGroup[];
  breadcrumb: string;
  children: ReactNode;
  displayName: string;
  density: "comfortable" | "compact";
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
  density,
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
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const sidebarWidth = hidden ? "0px" : mode === "compact" ? "72px" : "252px";

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
      <nav className="mt-4 min-h-0 flex-1 overflow-y-auto overflow-x-visible pb-3">
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
      data-sidebar-hidden={hidden}
      data-sidebar-mode={mode}
      data-workspace-density={density}
      style={{ "--sidebar-width": sidebarWidth } as CSSProperties}
    >
      <aside
        aria-label="主导航"
        className={`fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-white/10 bg-[radial-gradient(circle_at_10%_0%,rgba(24,175,179,.24),transparent_29%),linear-gradient(180deg,#0a2b4b_0%,#0a2340_58%,#06182c_100%)] py-4 text-white shadow-[12px_0_36px_rgba(6,24,44,.12)] transition-[width,transform] duration-200 print:hidden lg:flex ${
          hidden ? "pointer-events-none -translate-x-full" : "translate-x-0"
        } ${mode === "compact" ? "w-[72px] overflow-visible px-2" : "w-[252px] overflow-hidden px-3.5"}`}
      >
        <div className={`border-b border-white/[0.08] pb-5 pt-1 ${mode === "compact" ? "px-1" : "px-2.5"}`}>
          <NebulaLogo compact={mode === "compact"} inverse />
        </div>
        {navigation(mode === "compact")}
        <div className={`mt-2 flex gap-1 border-t border-white/10 pt-3 ${mode === "compact" ? "flex-col" : "items-center"}`}>
          <button
            aria-label={mode === "expanded" ? "收窄侧边栏" : "展开侧边栏"}
            className="grid size-9 place-items-center rounded-xl text-white/55 transition hover:bg-white/10 hover:text-white"
            onClick={toggleCompact}
            title={mode === "expanded" ? "收窄侧边栏" : "展开侧边栏"}
            type="button"
          >
            {mode === "expanded" ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />}
          </button>
          <button
            aria-label="隐藏侧边栏"
            className="grid size-9 place-items-center rounded-xl text-white/55 transition hover:bg-white/10 hover:text-white"
            onClick={toggleHidden}
            title="隐藏侧边栏（Ctrl/Command + \\）"
            type="button"
          >
            <EyeOff className="size-4" />
          </button>
          <Link
            aria-label="账号信息"
            className={`rounded-xl transition hover:bg-white/10 ${mode === "compact" ? "grid size-9 place-items-center" : "ml-auto flex min-w-0 items-center gap-2 px-2 py-1"}`}
            href="/account"
            title={`${displayName} · ${roleLabel}`}
          >
            <EmployeeAvatar name={displayName} size="sm" src={avatarUrl} />
            {mode === "expanded" ? <span className="min-w-0 truncate text-[10px] text-white/65">{displayName}</span> : null}
          </Link>
        </div>
      </aside>

      {hidden ? (
        <button
          aria-label="恢复侧边栏"
          className="fixed left-3 top-20 z-30 hidden size-10 place-items-center rounded-xl border border-border bg-white text-primary shadow-lg transition hover:bg-muted lg:grid print:hidden"
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
            className="absolute inset-0 bg-[#06182c]/55 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            type="button"
          />
          <div
            aria-label="移动端主导航"
            aria-modal="true"
            className="absolute inset-y-0 left-0 flex w-[min(88vw,320px)] flex-col overflow-hidden bg-[linear-gradient(180deg,#0a2b4b,#06182c)] px-4 py-4 text-white shadow-2xl"
            onKeyDown={handleDrawerKeyDown}
            ref={drawerRef}
            role="dialog"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <NebulaLogo inverse />
              <button
                aria-label="关闭导航"
                className="grid size-10 place-items-center rounded-xl text-white/65 hover:bg-white/10"
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
        <header className="sticky top-0 z-20 flex h-[72px] items-center border-b border-border/80 bg-white/88 px-4 backdrop-blur-xl print:hidden sm:px-6 xl:px-8">
          <button
            aria-expanded={mobileOpen}
            aria-label="打开主导航"
            className="mr-2 grid size-10 place-items-center rounded-xl border border-border bg-white text-muted-foreground lg:hidden"
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
              className="grid size-9 place-items-center rounded-xl border border-border bg-white text-muted-foreground md:hidden"
              onClick={() => setCommandOpen(true)}
              type="button"
            >
              <Search className="size-4" />
            </button>
            <form action="/search" className="relative hidden md:block" method="get">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/60" />
              <input
                aria-label="全局搜索"
                className="h-9 w-52 rounded-xl border border-border bg-[#f3f7fa] pl-9 pr-12 text-[10px] outline-none transition-all placeholder:text-muted-foreground/55 focus:w-64 focus:border-primary/35 focus:bg-white focus:ring-4 focus:ring-primary/7 xl:w-64"
                name="q"
                placeholder="搜索功能、员工、单据编号…"
                type="search"
              />
              <span className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 rounded border border-border bg-white px-1.5 py-0.5 text-[8px] text-muted-foreground xl:flex">
                <Command className="size-2.5" />K
              </span>
            </form>
            <Link
              aria-label={`查看消息，${unreadCount} 条未读`}
              className="relative grid size-9 place-items-center rounded-xl border border-border bg-white text-muted-foreground hover:bg-muted"
              href="/notifications"
            >
              <Bell className="size-4" />
              {unreadCount > 0 ? <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-[#ef6b73]" /> : null}
            </Link>
            <Link
              aria-label="打开使用指南"
              className="grid size-9 place-items-center rounded-xl border border-border bg-white text-muted-foreground hover:bg-muted"
              href="/help"
            >
              <CircleHelp className="size-4" />
            </Link>
            <Link aria-label="进入账号信息管理" className="rounded-full" href="/account">
              <EmployeeAvatar name={displayName} size="sm" src={avatarUrl} />
            </Link>
            <form action="/auth/signout" method="post">
              <button className="hidden h-8 rounded-xl border border-border bg-white px-3 text-[10px] text-muted-foreground hover:bg-muted sm:block" type="submit">
                退出
              </button>
            </form>
          </div>
        </header>
        {children}
      </div>
      {commandOpen ? <CommandCenter groups={[...mainGroups, ...bottomGroups]} onClose={() => setCommandOpen(false)} /> : null}
    </div>
  );
}
