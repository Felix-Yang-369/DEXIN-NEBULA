"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ChevronLeft, ChevronRight, Download, GripVertical, Inbox, Pin, SlidersHorizontal } from "lucide-react";
import { EmptyState } from "@/components/ui/application";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { BusinessViewConfig, SavedBusinessView } from "@/types/business-view";

export type BusinessTableColumn = {
  key: string;
  label: string;
  align?: "left" | "center" | "right";
  className?: string;
  sortable?: boolean;
  sticky?: boolean;
  hideOnMobile?: boolean;
};

type FilterTag = { key: string; label: string; value: string };

type BusinessDataTableProps = {
  columns: BusinessTableColumn[];
  rows: Array<Record<string, ReactNode>>;
  rowKeys: string[];
  total: number;
  page: number;
  pageSize: number;
  pathname: string;
  searchParams?: Record<string, string | undefined>;
  filters?: ReactNode;
  activeFilters?: FilterTag[];
  clearFiltersHref?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  density?: "comfortable" | "compact";
  caption?: string;
  selectable?: boolean;
  bulkActions?: ReactNode;
  exportHref?: string;
  sortKey?: string;
  sortDirection?: "asc" | "desc";
  viewKey?: string;
};

function pageHref(pathname: string, searchParams: Record<string, string | undefined>, page: number, pageSize?: number) {
  const params = new URLSearchParams();
  Object.entries(searchParams).forEach(([key, value]) => value && params.set(key, value));
  params.set("page", String(page));
  if (pageSize) params.set("pageSize", String(pageSize));
  return `${pathname}?${params.toString()}`;
}

function normalizeConfig(config: Partial<BusinessViewConfig>, columns: BusinessTableColumn[], fallbackPageSize: number): BusinessViewConfig {
  const allowed = new Set(columns.map((column) => column.key));
  const order = (config.columnOrder ?? []).filter((key) => allowed.has(key));
  columns.forEach((column) => { if (!order.includes(column.key)) order.push(column.key); });
  const visible = (config.visibleColumns ?? []).filter((key) => allowed.has(key));
  return {
    visibleColumns: visible.length ? visible : columns.map((column) => column.key),
    columnOrder: order,
    columnWidths: Object.fromEntries(Object.entries(config.columnWidths ?? {}).filter(([key, width]) => allowed.has(key) && width >= 80 && width <= 480)),
    stickyColumns: (config.stickyColumns ?? []).filter((key) => allowed.has(key)).slice(0, 3),
    sort: config.sort,
    filters: config.filters ?? {},
    pageSize: config.pageSize === 50 || config.pageSize === 100 ? config.pageSize : fallbackPageSize === 50 || fallbackPageSize === 100 ? fallbackPageSize : 20,
    density: "compact",
  };
}

export function BusinessDataTable({
  columns, rows, rowKeys, total, page, pageSize, pathname, searchParams = {}, filters,
  activeFilters = [], clearFiltersHref, emptyTitle = "暂无数据",
  emptyDescription = "当前条件下没有可展示的内容，请调整筛选条件或创建第一条记录。",
  emptyAction, caption, selectable = false, bulkActions, exportHref, sortKey,
  sortDirection = "asc", viewKey,
}: BusinessDataTableProps) {
  const defaults = useMemo(() => normalizeConfig({}, columns, pageSize), [columns, pageSize]);
  const [config, setConfig] = useState(defaults);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [savedViews, setSavedViews] = useState<SavedBusinessView[]>([]);
  const [activeViewId, setActiveViewId] = useState("");
  const [viewName, setViewName] = useState("我的视图");
  const [deleteTarget, setDeleteTarget] = useState<SavedBusinessView | null>(null);
  const [isPending, startTransition] = useTransition();
  const { notify } = useToast();

  const orderedColumns = useMemo(() => config.columnOrder.map((key) => columns.find((column) => column.key === key)).filter((column): column is BusinessTableColumn => Boolean(column)), [columns, config.columnOrder]);
  const visibleColumns = orderedColumns.filter((column) => config.visibleColumns.includes(column.key));
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const allSelected = rows.length > 0 && rows.every((_, index) => selectedKeys.includes(rowKeys[index]));
  const stickyLeft = useMemo(() => {
    let left = selectable ? 44 : 0;
    return Object.fromEntries(visibleColumns.map((column) => {
      const result = [column.key, left] as const;
      if (config.stickyColumns.includes(column.key) || column.sticky) left += config.columnWidths[column.key] ?? 160;
      return result;
    }));
  }, [config.columnWidths, config.stickyColumns, selectable, visibleColumns]);

  useEffect(() => {
    if (!viewKey) return;
    let cancelled = false;
    void fetch(`/api/workspace/views/${encodeURIComponent(viewKey)}`, { headers: { Accept: "application/json" } })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("load_failed")))
      .then((payload) => {
        if (cancelled) return;
        const views = Array.isArray(payload.views) ? payload.views as SavedBusinessView[] : [];
        setSavedViews(views);
        if (views[0]) {
          setActiveViewId(views[0].id);
          setViewName(views[0].name);
          setConfig(normalizeConfig(views[0].config, columns, pageSize));
        }
      })
      .catch(() => notify({ title: "个人视图加载失败", description: "已使用默认列设置，稍后可以重试保存。", tone: "warning" }));
    return () => { cancelled = true; };
  }, [columns, notify, pageSize, viewKey]);

  function currentConfig(): BusinessViewConfig {
    return { ...config, sort: sortKey ? { key: sortKey, direction: sortDirection } : undefined, filters: Object.fromEntries(activeFilters.map((filter) => [filter.key, filter.value])), pageSize: pageSize === 50 || pageSize === 100 ? pageSize : 20, density: "compact" };
  }

  function applyView(view: SavedBusinessView) {
    setActiveViewId(view.id);
    setViewName(view.name);
    setConfig(normalizeConfig(view.config, columns, pageSize));
  }

  function saveView() {
    if (!viewKey) return;
    startTransition(async () => {
      try {
        const nextConfig = currentConfig();
        const response = await fetch(`/api/workspace/views/${encodeURIComponent(viewKey)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: viewName.trim(), config: nextConfig }) });
        if (!response.ok) throw new Error("save_failed");
        const payload = await response.json();
        const next: SavedBusinessView = { id: payload.id, name: viewName.trim(), config: nextConfig, updated_at: new Date().toISOString() };
        setSavedViews((views) => [next, ...views.filter((view) => view.id !== next.id)].slice(0, 10));
        setActiveViewId(next.id);
        notify({ title: "个人视图已保存", description: "列、排序、筛选和分页设置已同步。", tone: "success" });
      } catch {
        notify({ title: "保存失败", description: "请检查网络后重试。", tone: "danger", actionLabel: "重试", onAction: saveView });
      }
    });
  }

  function renameView() {
    if (!viewKey || !activeViewId) return;
    startTransition(async () => {
      const response = await fetch(`/api/workspace/views/${encodeURIComponent(viewKey)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: activeViewId, name: viewName.trim() }) });
      if (!response.ok) {
        notify({ title: "重命名失败", tone: "danger" });
        return;
      }
      setSavedViews((views) => views.map((view) => view.id === activeViewId ? { ...view, name: viewName.trim() } : view));
      notify({ title: "视图名称已更新", tone: "success" });
    });
  }

  function deleteView() {
    if (!viewKey || !deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    startTransition(async () => {
      const response = await fetch(`/api/workspace/views/${encodeURIComponent(viewKey)}?id=${encodeURIComponent(target.id)}`, { method: "DELETE" });
      if (!response.ok) {
        notify({ title: "删除视图失败", tone: "danger" });
        return;
      }
      setSavedViews((views) => views.filter((view) => view.id !== target.id));
      if (activeViewId === target.id) { setActiveViewId(""); setViewName("我的视图"); setConfig(defaults); }
      notify({ title: "个人视图已删除", tone: "success" });
    });
  }

  function moveColumn(key: string, offset: -1 | 1) {
    setConfig((current) => {
      const order = [...current.columnOrder];
      const index = order.indexOf(key);
      const next = index + offset;
      if (index < 0 || next < 0 || next >= order.length) return current;
      [order[index], order[next]] = [order[next], order[index]];
      return { ...current, columnOrder: order };
    });
  }

  function sortHref(column: BusinessTableColumn) {
    const nextDirection = sortKey === column.key && sortDirection === "asc" ? "desc" : "asc";
    return pageHref(pathname, { ...searchParams, sort: column.key, order: nextDirection }, 1);
  }

  return (
    <section className="overflow-hidden rounded-md border border-border bg-white">
      {(filters || exportHref || columns.length > 1) ? <div className="ui-toolbar">
        {filters ? <div className="min-w-0 flex-1">{filters}</div> : <div className="flex-1" />}
        {viewKey ? <details className="relative"><summary className="flex h-9 cursor-pointer list-none items-center gap-2 rounded-md border border-border bg-white px-3 text-xs text-muted-foreground">个人视图</summary><div className="ui-overlay absolute right-0 top-11 z-30 w-72 space-y-3 p-3">
          {savedViews.length ? <select aria-label="切换个人视图" className="h-9 w-full rounded-md border border-border bg-white px-2 text-xs" onChange={(event) => { const view = savedViews.find((item) => item.id === event.target.value); if (view) applyView(view); }} value={activeViewId}><option value="">默认视图</option>{savedViews.map((view) => <option key={view.id} value={view.id}>{view.name}</option>)}</select> : <p className="text-xs text-muted-foreground">尚未保存个人视图</p>}
          <input aria-label="视图名称" className="h-9 w-full rounded-md border border-border px-3 text-xs" maxLength={40} onChange={(event) => setViewName(event.target.value)} value={viewName} />
          <div className="flex gap-2"><button className="h-9 flex-1 rounded-md bg-primary px-3 text-xs text-white disabled:opacity-50" disabled={isPending || viewName.trim().length < 2} onClick={saveView} type="button">保存为新视图</button>{activeViewId ? <button className="h-9 rounded-md border border-border px-3 text-xs" disabled={isPending || viewName.trim().length < 2} onClick={renameView} type="button">重命名</button> : null}</div>
          {activeViewId ? <button className="text-xs text-danger" disabled={isPending} onClick={() => setDeleteTarget(savedViews.find((view) => view.id === activeViewId) ?? null)} type="button">删除当前视图</button> : null}
        </div></details> : null}
        <details className="relative"><summary className="flex h-9 cursor-pointer list-none items-center gap-2 rounded-md border border-border bg-white px-3 text-xs text-muted-foreground"><SlidersHorizontal className="size-3.5" />列设置</summary><div className="ui-overlay absolute right-0 top-11 z-30 max-h-[65vh] w-80 overflow-y-auto p-2">
          {orderedColumns.map((column, index) => { const visible = config.visibleColumns.includes(column.key); const pinned = config.stickyColumns.includes(column.key) || column.sticky; return <div className="grid grid-cols-[1fr_auto] items-center gap-2 border-b border-border px-2 py-2 last:border-0" key={column.key}><label className="flex min-w-0 items-center gap-2 text-xs"><input checked={visible} disabled={visible && config.visibleColumns.length === 1} onChange={(event) => setConfig((current) => ({ ...current, visibleColumns: event.target.checked ? [...current.visibleColumns, column.key] : current.visibleColumns.filter((key) => key !== column.key) }))} type="checkbox" /><GripVertical className="size-3.5 text-muted-foreground" /><span className="truncate">{column.label}</span></label><div className="flex items-center gap-1"><button aria-label={`${column.label}左移`} className="grid size-8 place-items-center rounded-sm hover:bg-muted disabled:opacity-30" disabled={index === 0} onClick={() => moveColumn(column.key, -1)} type="button"><ArrowLeft className="size-3" /></button><button aria-label={`${column.label}右移`} className="grid size-8 place-items-center rounded-sm hover:bg-muted disabled:opacity-30" disabled={index === orderedColumns.length - 1} onClick={() => moveColumn(column.key, 1)} type="button"><ArrowRight className="size-3" /></button><button aria-label={`${pinned ? "取消固定" : "固定"}${column.label}`} className={cn("grid size-8 place-items-center rounded-sm hover:bg-muted", pinned && "text-primary")} disabled={Boolean(column.sticky) || (!pinned && config.stickyColumns.length >= 3)} onClick={() => setConfig((current) => ({ ...current, stickyColumns: pinned ? current.stickyColumns.filter((key) => key !== column.key) : [...current.stickyColumns, column.key] }))} type="button"><Pin className="size-3" /></button></div><div className="col-span-2 flex items-center gap-2 pl-7 text-xs text-muted-foreground"><span>宽度</span><input aria-label={`${column.label}列宽`} className="h-8 flex-1 accent-primary" max={480} min={80} onChange={(event) => setConfig((current) => ({ ...current, columnWidths: { ...current.columnWidths, [column.key]: Number(event.target.value) } }))} step={20} type="range" value={config.columnWidths[column.key] ?? 160} /><span className="w-12 text-right tabular-nums">{config.columnWidths[column.key] ?? 160}px</span></div></div>; })}
        </div></details>
        {exportHref ? <Link className="flex h-9 items-center gap-2 rounded-md border border-border bg-white px-3 text-xs text-primary" href={exportHref}><Download className="size-3.5" />导出</Link> : null}
      </div> : null}
      {activeFilters.length ? <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5"><span className="text-xs text-muted-foreground">当前筛选</span>{activeFilters.map((filter) => <span className="rounded-full bg-info-surface px-2 py-1 text-xs text-info" key={`${filter.key}:${filter.value}`}>{filter.label}：{filter.value}</span>)}{clearFiltersHref ? <Link className="ml-auto text-xs text-primary underline underline-offset-4" href={clearFiltersHref}>清空全部</Link> : null}</div> : null}
      {selectable && selectedKeys.length ? <div className="flex min-h-11 items-center gap-3 border-b border-border bg-info-surface px-4 text-xs text-foreground"><span>已选 {selectedKeys.length} 项</span><div className="ml-auto">{bulkActions}</div><button className="underline" onClick={() => setSelectedKeys([])} type="button">取消选择</button></div> : null}
      <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[760px] text-[13px]">{caption ? <caption className="sr-only">{caption}</caption> : null}<thead className="bg-muted text-left text-xs font-medium text-muted-foreground"><tr>{selectable ? <th className="sticky left-0 z-20 w-11 bg-muted px-3 py-2"><input aria-label="选择当前页全部数据" checked={allSelected} onChange={(event) => setSelectedKeys(event.target.checked ? [...new Set([...selectedKeys, ...rowKeys])] : selectedKeys.filter((key) => !rowKeys.includes(key)))} type="checkbox" /></th> : null}{visibleColumns.map((column) => { const sticky = config.stickyColumns.includes(column.key) || column.sticky; const width = config.columnWidths[column.key] ?? 160; return <th className={cn("px-3 py-2", column.align === "center" && "text-center", column.align === "right" && "text-right", sticky && "sticky z-10 bg-muted", column.className)} key={column.key} style={{ left: sticky ? stickyLeft[column.key] : undefined, minWidth: width, width } as CSSProperties}>{column.sortable ? <Link className="inline-flex items-center gap-1 hover:text-foreground" href={sortHref(column)}>{column.label}{sortKey === column.key ? sortDirection === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" /> : null}</Link> : column.label}</th>; })}</tr></thead><tbody>{rows.map((row, index) => <tr className="h-10 border-t border-border/80 hover:bg-muted" key={rowKeys[index]}>{selectable ? <td className="sticky left-0 z-10 w-11 bg-white px-3 py-2"><input aria-label={`选择第 ${index + 1} 行`} checked={selectedKeys.includes(rowKeys[index])} onChange={(event) => setSelectedKeys((current) => event.target.checked ? [...current, rowKeys[index]] : current.filter((key) => key !== rowKeys[index]))} type="checkbox" /></td> : null}{visibleColumns.map((column) => { const sticky = config.stickyColumns.includes(column.key) || column.sticky; return <td className={cn("px-3 py-2 text-foreground", column.align === "center" && "text-center", column.align === "right" && "text-right tabular-nums", sticky && "sticky z-[5] bg-white", column.className)} key={column.key} style={{ left: sticky ? stickyLeft[column.key] : undefined }}>{row[column.key]}</td>; })}</tr>)}</tbody></table></div>
      <div className="divide-y divide-border md:hidden">{rows.map((row, index) => <article className="space-y-3 p-4" key={rowKeys[index]}>{selectable ? <label className="flex min-h-11 items-center gap-2 text-xs text-muted-foreground"><input checked={selectedKeys.includes(rowKeys[index])} onChange={(event) => setSelectedKeys((current) => event.target.checked ? [...current, rowKeys[index]] : current.filter((key) => key !== rowKeys[index]))} type="checkbox" />选择该项</label> : null}{visibleColumns.filter((column) => !column.hideOnMobile).map((column) => <div className="grid grid-cols-[88px_1fr] gap-3 text-sm" key={column.key}><span className="text-muted-foreground">{column.label}</span><div className={cn("min-w-0 text-foreground", column.align === "right" && "text-right tabular-nums")}>{row[column.key]}</div></div>)}</article>)}</div>
      {!rows.length ? <EmptyState action={emptyAction} className="border-0 border-t" description={emptyDescription} icon={<Inbox className="size-6" />} title={emptyTitle} /> : null}
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-xs text-muted-foreground"><span>共 {total} 条 · 第 {page}/{totalPages} 页</span><div className="flex items-center gap-2"><span>每页</span>{([20, 50, 100] as const).map((size) => <Link aria-current={pageSize === size ? "page" : undefined} className={cn("grid h-8 min-w-8 place-items-center rounded-sm border border-border px-1.5", pageSize === size && "border-primary bg-info-surface text-primary")} href={pageHref(pathname, searchParams, 1, size)} key={size}>{size}</Link>)}<Link aria-disabled={page <= 1} className={cn("grid size-8 place-items-center rounded-sm border border-border", page <= 1 && "pointer-events-none opacity-35")} href={pageHref(pathname, searchParams, Math.max(1, page - 1), pageSize)}><ChevronLeft className="size-3.5" /></Link><Link aria-disabled={page >= totalPages} className={cn("grid size-8 place-items-center rounded-sm border border-border", page >= totalPages && "pointer-events-none opacity-35")} href={pageHref(pathname, searchParams, Math.min(totalPages, page + 1), pageSize)}><ChevronRight className="size-3.5" /></Link></div></footer>
      <ConfirmDialog confirmLabel="删除视图" description="删除后不能恢复，但不会影响业务数据。" impact="该视图保存的列顺序、筛选与分页设置将被永久移除。" objectName={deleteTarget?.name ?? ""} onCancel={() => setDeleteTarget(null)} onConfirm={deleteView} open={Boolean(deleteTarget)} title="确认删除个人视图？" tone="danger" />
    </section>
  );
}
