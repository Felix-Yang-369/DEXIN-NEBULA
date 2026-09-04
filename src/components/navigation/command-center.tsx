"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Clock3, CornerDownLeft, FilePlus2, Search, Sparkles, Star, X } from "lucide-react";
import type { PlatformNavigationGroup } from "@/config/platform-navigation";
import { cn } from "@/lib/utils";

type StoredItem = { href: string; label: string };
type CommandItem = StoredItem & { group: string };
const RECENT_KEY = "nebula_recent_navigation:v2";
const FAVORITE_KEY = "nebula_navigation_favorites:v1";

function readStored(key: string): StoredItem[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is StoredItem => Boolean(item && typeof item === "object" && "href" in item && "label" in item && typeof item.href === "string" && typeof item.label === "string")).slice(0, 8);
  } catch {
    return [];
  }
}

const quickCreates: CommandItem[] = [
  { href: "/requests/leave", label: "新建请假申请", group: "快捷新建" },
  { href: "/requests/expense", label: "新建费用报销", group: "快捷新建" },
  { href: "/requests/seal", label: "新建用印申请", group: "快捷新建" },
  { href: "/sales#orders", label: "新建销售订单草稿", group: "快捷新建" },
];

export function CommandCenter({ groups, onClose }: { groups: PlatformNavigationGroup[]; onClose: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [recent] = useState<StoredItem[]>(() => typeof window === "undefined" ? [] : readStored(RECENT_KEY));
  const [favorites, setFavorites] = useState<StoredItem[]>(() => typeof window === "undefined" ? [] : readStored(FAVORITE_KEY));
  const [activeIndex, setActiveIndex] = useState(0);
  const items = useMemo(() => groups.flatMap((group) => group.items.flatMap((item) => [{ href: item.href, label: item.label, group: group.label }, ...(item.children ?? []).map((child) => ({ href: child.href, label: child.label, group: item.label }))])), [groups]);
  const normalized = query.trim().toLocaleLowerCase("zh-CN");
  const navigationResults = normalized ? items.filter((item) => `${item.label} ${item.group}`.toLocaleLowerCase("zh-CN").includes(normalized)).slice(0, 7) : [];
  const results = normalized ? [...navigationResults, { href: `/search?q=${encodeURIComponent(query)}`, label: `搜索业务数据“${query}”`, group: "权限内搜索" }] : [...quickCreates, ...items.slice(0, 4)];

  useEffect(() => {
    const item = items.find((candidate) => candidate.href.split(/[?#]/)[0] === pathname);
    if (!item) return;
    const next = [{ href: item.href, label: item.label }, ...readStored(RECENT_KEY).filter((recentItem) => recentItem.href !== item.href)].slice(0, 6);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  }, [items, pathname]);

  function go(item: CommandItem | StoredItem) {
    onClose();
    router.push(item.href);
  }

  function toggleFavorite(item: CommandItem | StoredItem) {
    setFavorites((current) => {
      const next = current.some((favorite) => favorite.href === item.href) ? current.filter((favorite) => favorite.href !== item.href) : [{ href: item.href, label: item.label }, ...current].slice(0, 8);
      localStorage.setItem(FAVORITE_KEY, JSON.stringify(next));
      return next;
    });
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") return onClose();
    if (event.key === "ArrowDown") { event.preventDefault(); setActiveIndex((index) => Math.min(results.length - 1, index + 1)); }
    if (event.key === "ArrowUp") { event.preventDefault(); setActiveIndex((index) => Math.max(0, index - 1)); }
    if (event.key === "Enter" && results[activeIndex]) { event.preventDefault(); go(results[activeIndex]); }
  }

  const storedSection = (title: string, icon: ReactNode, storedItems: StoredItem[]) => storedItems.length ? <div className="mb-3"><div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-muted-foreground">{icon}{title}</div><div className="grid gap-1 sm:grid-cols-2">{storedItems.map((item) => <div className="flex min-w-0 items-center rounded-md hover:bg-muted" key={item.href}><button className="min-h-11 min-w-0 flex-1 truncate px-3 text-left text-xs" onClick={() => go(item)} type="button">{item.label}</button><button aria-label={`取消收藏${item.label}`} className="grid size-10 place-items-center text-intelligence" onClick={() => toggleFavorite(item)} type="button"><Star className="size-3.5 fill-current" /></button></div>)}</div></div> : null;

  return (
    <div className="fixed inset-0 z-[70] grid place-items-start bg-foreground/40 px-3 pt-[8vh] backdrop-blur-sm sm:px-4 sm:pt-[12vh]" role="presentation">
      <button aria-label="关闭命令中心" className="absolute inset-0" onClick={onClose} type="button" />
      <section aria-label="命令中心" aria-modal="true" className="ui-overlay relative mx-auto w-full max-w-2xl overflow-hidden rounded-lg border-white/70" role="dialog">
        <div className="flex items-center gap-3 border-b border-border px-4"><Search className="size-5 text-primary" /><input aria-activedescendant={`command-${activeIndex}`} aria-controls="command-results" aria-expanded="true" aria-label="搜索命令和业务数据" autoFocus className="h-14 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); }} onKeyDown={handleKeyDown} placeholder="搜索模块、客户或单据编号…" ref={inputRef} role="combobox" value={query} /><span className="hidden text-xs text-muted-foreground sm:block">↑↓ 选择 · Enter 执行</span><button aria-label="关闭" className="grid size-10 place-items-center rounded-md text-muted-foreground hover:bg-muted" onClick={onClose} type="button"><X className="size-4" /></button></div>
        <div className="max-h-[68vh] overflow-y-auto p-3">
          {!normalized ? <>{storedSection("收藏", <Star className="size-3.5" />, favorites)}{recent.length ? <div className="mb-3"><div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-muted-foreground"><Clock3 className="size-3.5" />最近访问</div><div className="grid gap-1 sm:grid-cols-2">{recent.map((item) => <button className="min-h-11 truncate rounded-md px-3 text-left text-xs hover:bg-muted" key={item.href} onClick={() => go(item)} type="button">{item.label}</button>)}</div></div> : null}</> : null}
          <div className="px-3 py-2 text-xs font-semibold text-muted-foreground">{normalized ? "搜索结果" : "快捷操作"}</div>
          <div className="space-y-1" id="command-results" role="listbox">{results.map((item, index) => <div aria-selected={index === activeIndex} className={cn("flex min-h-12 items-center rounded-md", index === activeIndex && "bg-info-surface")} id={`command-${index}`} key={`${item.href}:${item.label}`} role="option"><button className="flex min-h-12 min-w-0 flex-1 items-center gap-3 px-3 text-left text-xs" onClick={() => go(item)} onMouseEnter={() => setActiveIndex(index)} type="button">{item.group === "快捷新建" ? <FilePlus2 className="size-4 text-primary" /> : item.group === "权限内搜索" ? <Sparkles className="size-4 text-intelligence" /> : null}<span className="min-w-0 flex-1 truncate">{item.label}</span><span className="shrink-0 text-xs text-muted-foreground">{item.group}</span>{index === activeIndex ? <CornerDownLeft className="size-3.5 text-primary" /> : null}</button>{item.group !== "权限内搜索" ? <button aria-label={`${favorites.some((favorite) => favorite.href === item.href) ? "取消收藏" : "收藏"}${item.label}`} className={cn("grid size-11 place-items-center text-muted-foreground", favorites.some((favorite) => favorite.href === item.href) && "text-intelligence")} onClick={() => toggleFavorite(item)} type="button"><Star className={cn("size-3.5", favorites.some((favorite) => favorite.href === item.href) && "fill-current")} /></button> : null}</div>)}</div>
        </div>
      </section>
    </div>
  );
}
