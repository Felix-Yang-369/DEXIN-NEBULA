"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bot, CheckSquare2, FilePlus2, Home, PackageSearch, Plus, ReceiptText, ShoppingCart, Stamp, UserRound, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const primaryItems: Array<{ href: string; label: string; icon: LucideIcon; action?: boolean }> = [
  { href: "/mobile", label: "首页", icon: Home },
  { href: "/approvals", label: "待办", icon: CheckSquare2 },
  { href: "#new", label: "新建", icon: Plus, action: true },
  { href: "/ai", label: "德小馨", icon: Bot },
  { href: "/account", label: "我的", icon: UserRound },
];

const quickCreateItems = [
  { href: "/requests/leave", label: "请假申请", icon: FilePlus2 },
  { href: "/requests/expense", label: "费用报销", icon: ReceiptText },
  { href: "/requests/seal", label: "用印申请", icon: Stamp },
  { href: "/purchasing#requests", label: "采购申请", icon: ShoppingCart },
  { href: "/mobile/orders/new", label: "销售订单", icon: FilePlus2 },
  { href: "/mobile/scan", label: "扫码查商品", icon: PackageSearch },
] as const;

export const desktopOnlyPrefixes = [
  "/finance/accounting",
  "/finance/bank-reconciliation",
  "/roles",
  "/audit",
  "/system",
];

export function MobileDesktopOnlyNotice() {
  return (
    <section className="mx-4 mt-5 rounded-md border border-attention/25 bg-attention-surface p-5 lg:hidden">
      <h1 className="text-lg font-semibold text-foreground">请在桌面端处理</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">此功能涉及宽表格、批量配置或高风险操作。移动端暂时只提供审批、申请、订单草稿、业务查询和德小馨。</p>
      <Link className="mt-4 inline-flex min-h-11 items-center text-sm font-medium text-primary" href="/mobile">返回移动工作台</Link>
    </section>
  );
}

export function MobileTaskShell() {
  const pathname = usePathname();
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    if (!createOpen) return;
    const close = (event: KeyboardEvent) => event.key === "Escape" && setCreateOpen(false);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [createOpen]);

  return (
    <>
      {createOpen ? <div className="fixed inset-0 z-50 lg:hidden"><button aria-label="关闭新建菜单" className="absolute inset-0 bg-foreground/40" onClick={() => setCreateOpen(false)} type="button" /><section aria-label="移动端新建" aria-modal="true" className="ui-overlay absolute inset-x-0 bottom-0 rounded-t-lg px-4 pb-24 pt-4" role="dialog"><div className="mb-3 flex items-center justify-between"><div><h2 className="text-base font-semibold">新建业务</h2><p className="mt-1 text-xs text-muted-foreground">选择今天要发起的事项</p></div><button aria-label="关闭" className="grid size-11 place-items-center rounded-md hover:bg-muted" onClick={() => setCreateOpen(false)} type="button"><X className="size-5" /></button></div><div className="grid grid-cols-2 gap-2">{quickCreateItems.map((item) => { const Icon = item.icon; return <Link className="flex min-h-14 items-center gap-3 rounded-md border border-border px-3 text-sm text-foreground active:bg-muted" href={item.href} key={item.href}><Icon className="size-4 text-primary" />{item.label}</Link>; })}</div><p className="mt-3 text-xs leading-5 text-muted-foreground">付款、过账、权限配置和批量维护等高风险或复杂操作仍需在桌面端完成。</p></section></div> : null}
      <nav aria-label="移动端任务导航" className="fixed inset-x-0 bottom-0 z-40 grid h-16 grid-cols-5 border-t border-border bg-white/96 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden print:hidden">{primaryItems.map((item) => { const Icon = item.icon; const active = !item.action && (pathname === item.href || (item.href !== "/mobile" && pathname.startsWith(item.href))); return item.action ? <button aria-expanded={createOpen} className="flex min-h-11 flex-col items-center justify-center gap-1 text-xs text-primary" key={item.href} onClick={() => setCreateOpen(true)} type="button"><span className="grid size-9 place-items-center rounded-full bg-primary text-white"><Icon className="size-5" /></span><span className="sr-only">{item.label}</span></button> : <Link aria-current={active ? "page" : undefined} className={cn("flex min-h-11 flex-col items-center justify-center gap-1 text-xs text-muted-foreground", active && "text-primary")} href={item.href} key={item.href} onClick={() => setCreateOpen(false)}><Icon className="size-5" /><span>{item.label}</span></Link>; })}</nav>
    </>
  );
}
