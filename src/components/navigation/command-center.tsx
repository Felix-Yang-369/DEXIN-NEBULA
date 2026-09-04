"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Clock3, CornerDownLeft, Search, Sparkles, X } from "lucide-react";
import type { PlatformNavigationGroup } from "@/config/platform-navigation";

type RecentItem = { href: string; label: string };
const RECENT_KEY = "nebula_recent_navigation_v1";

function readRecent(): RecentItem[] {
  try {
    const value = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(value) ? value.slice(0, 6) : [];
  } catch {
    return [];
  }
}

export function CommandCenter({
  groups,
  onClose,
}: {
  groups: PlatformNavigationGroup[];
  onClose: () => void;
}) {
  const pathname = usePathname();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [recent] = useState<RecentItem[]>(() => typeof window === "undefined" ? [] : readRecent());
  const items = useMemo(
    () => groups.flatMap((group) => group.items.flatMap((item) => [
      { href: item.href, label: item.label, group: group.label },
      ...(item.children ?? []).map((child) => ({ href: child.href, label: child.label, group: item.label })),
    ])),
    [groups],
  );
  const normalized = query.trim().toLocaleLowerCase("zh-CN");
  const filtered = normalized
    ? items.filter((item) => `${item.label} ${item.group}`.toLocaleLowerCase("zh-CN").includes(normalized)).slice(0, 8)
    : items.slice(0, 8);

  useEffect(() => {
    const item = items.find((candidate) => candidate.href.split(/[?#]/)[0] === pathname);
    if (!item) return;
    const next = [{ href: item.href, label: item.label }, ...readRecent().filter((recentItem) => recentItem.href !== item.href)].slice(0, 6);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  }, [items, pathname]);

  return (
    <div className="fixed inset-0 z-[70] grid place-items-start bg-[#06182c]/45 px-4 pt-[12vh] backdrop-blur-sm" role="presentation">
      <button aria-label="关闭命令中心" className="absolute inset-0" onClick={onClose} type="button" />
      <section aria-label="命令中心" aria-modal="true" className="relative mx-auto w-full max-w-2xl overflow-hidden rounded-[22px] border border-white/70 bg-white shadow-[0_30px_100px_rgba(6,24,44,.28)]" role="dialog">
        <form action="/search" className="flex items-center gap-3 border-b border-border px-5" method="get">
          <Search className="size-5 text-primary" />
          <input ref={inputRef} aria-label="搜索命令和业务数据" autoFocus className="h-16 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" name="q" onChange={(event) => setQuery(event.target.value)} placeholder="搜索模块、员工、客户或单据编号…" value={query} />
          <button aria-label="关闭" className="grid size-9 place-items-center rounded-xl text-muted-foreground hover:bg-muted" onClick={onClose} type="button"><X className="size-4" /></button>
        </form>
        <div className="max-h-[60vh] overflow-y-auto p-3">
          {!normalized && recent.length ? <div className="mb-3"><div className="flex items-center gap-2 px-3 py-2 text-[9px] font-semibold tracking-[.12em] text-muted-foreground"><Clock3 className="size-3" />最近访问</div><div className="grid gap-1 sm:grid-cols-2">{recent.map((item) => <Link className="rounded-xl px-3 py-2.5 text-xs hover:bg-muted" href={item.href} key={item.href} onClick={onClose}>{item.label}</Link>)}</div></div> : null}
          <div className="px-3 py-2 text-[9px] font-semibold tracking-[.12em] text-muted-foreground">{normalized ? "功能与模块" : "快速进入"}</div>
          <div className="space-y-1">{filtered.map((item) => <Link className="flex items-center justify-between rounded-xl px-3 py-3 text-xs hover:bg-[#eef7f7]" href={item.href} key={`${item.href}:${item.label}`} onClick={onClose}><span>{item.label}</span><span className="text-[9px] text-muted-foreground">{item.group}</span></Link>)}</div>
          {normalized ? <Link className="mt-2 flex items-center gap-3 rounded-xl bg-[#0a385d] px-4 py-3 text-xs text-white" href={`/search?q=${encodeURIComponent(query)}`} onClick={onClose}><Sparkles className="size-4 text-[#79d8d5]" /><span className="flex-1">在权限范围内搜索业务数据</span><CornerDownLeft className="size-4" /></Link> : null}
        </div>
      </section>
    </div>
  );
}
