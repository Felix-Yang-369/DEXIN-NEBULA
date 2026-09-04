"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Download, Inbox, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

export type BusinessTableColumn = {
  key: string;
  label: string;
  align?: "left" | "center" | "right";
  className?: string;
  sortable?: boolean;
  sticky?: boolean;
  hideOnMobile?: boolean;
};

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
  emptyTitle?: string;
  emptyDescription?: string;
  density?: "comfortable" | "compact";
  caption?: string;
  selectable?: boolean;
  bulkActions?: ReactNode;
  exportHref?: string;
  sortKey?: string;
  sortDirection?: "asc" | "desc";
  viewKey?: string;
};

function pageHref(
  pathname: string,
  searchParams: Record<string, string | undefined>,
  page: number,
) {
  const params = new URLSearchParams();
  Object.entries(searchParams).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  params.set("page", String(page));
  return `${pathname}?${params.toString()}`;
}

export function BusinessDataTable({
  columns,
  rows,
  rowKeys,
  total,
  page,
  pageSize,
  pathname,
  searchParams = {},
  filters,
  emptyTitle = "暂无数据",
  emptyDescription = "调整筛选条件后重试。",
  density = "comfortable",
  caption,
  selectable = false,
  bulkActions,
  exportHref,
  sortKey,
  sortDirection = "asc",
  viewKey,
}: BusinessDataTableProps) {
  const [visibleKeys, setVisibleKeys] = useState(() => columns.map((column) => column.key));
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [viewStatus, setViewStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const visibleColumns = useMemo(() => columns.filter((column) => visibleKeys.includes(column.key)), [columns, visibleKeys]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const cellPadding = density === "compact" ? "px-3 py-2.5" : "px-4 py-3.5";
  const allSelected = rows.length > 0 && rows.every((_, index) => selectedKeys.includes(rowKeys[index]));

  useEffect(() => {
    if (!viewKey) return;
    let cancelled = false;
    void fetch(`/api/workspace/views/${encodeURIComponent(viewKey)}`, { headers: { Accept: "application/json" } })
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => {
        const saved = payload?.views?.[0]?.config?.visibleColumns;
        if (!cancelled && Array.isArray(saved)) {
          const allowed = saved.filter((key: unknown): key is string => typeof key === "string" && columns.some((column) => column.key === key));
          if (allowed.length) setVisibleKeys(allowed);
        }
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [columns, viewKey]);

  async function saveView() {
    if (!viewKey) return;
    setViewStatus("saving");
    try {
      const response = await fetch(`/api/workspace/views/${encodeURIComponent(viewKey)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "默认视图", visibleColumns: visibleKeys }) });
      setViewStatus(response.ok ? "saved" : "error");
    } catch {
      setViewStatus("error");
    }
  }

  function sortHref(column: BusinessTableColumn) {
    const nextDirection = sortKey === column.key && sortDirection === "asc" ? "desc" : "asc";
    return pageHref(pathname, { ...searchParams, sort: column.key, order: nextDirection }, 1);
  }

  return (
    <section className="overflow-hidden rounded-[20px] border border-border bg-white">
      {(filters || exportHref || columns.length > 1) && <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">{filters ? <div className="min-w-0 flex-1">{filters}</div> : <div className="flex-1" />}
        <details className="relative"><summary className="flex h-9 cursor-pointer list-none items-center gap-2 rounded-lg border border-border bg-white px-3 text-[10px] text-muted-foreground"><SlidersHorizontal className="size-3.5" />列显示</summary><div className="absolute right-0 top-11 z-30 w-52 rounded-xl border border-border bg-white p-3 shadow-xl">{columns.map((column) => <label className="flex items-center gap-2 rounded-lg px-2 py-2 text-[10px] hover:bg-muted" key={column.key}><input checked={visibleKeys.includes(column.key)} disabled={visibleKeys.length === 1 && visibleKeys.includes(column.key)} onChange={(event) => setVisibleKeys((current) => event.target.checked ? [...current, column.key] : current.filter((key) => key !== column.key))} type="checkbox" />{column.label}</label>)}</div></details>
        {viewKey ? <button className="h-9 rounded-lg border border-border bg-white px-3 text-[10px] text-primary disabled:opacity-60" disabled={viewStatus === "saving"} onClick={() => void saveView()} type="button">{viewStatus === "saving" ? "保存中" : viewStatus === "saved" ? "视图已保存" : viewStatus === "error" ? "保存失败" : "保存视图"}</button> : null}
        {exportHref ? <Link className="flex h-9 items-center gap-2 rounded-lg border border-border bg-white px-3 text-[10px] text-primary" href={exportHref}><Download className="size-3.5" />导出</Link> : null}
      </div>}
      {selectable && selectedKeys.length ? <div className="flex items-center gap-3 border-b border-border bg-[#eef8f5] px-4 py-3 text-[10px] text-[#285f53]"><span>已选 {selectedKeys.length} 项</span><div className="ml-auto">{bulkActions}</div><button className="underline" onClick={() => setSelectedKeys([])} type="button">取消选择</button></div> : null}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[760px] text-[11px]">
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <thead className="bg-[#f4f8fa] text-left text-[9px] font-medium uppercase tracking-[.08em] text-muted-foreground">
            <tr>
              {selectable ? <th className={cellPadding}><input aria-label="选择当前页全部数据" checked={allSelected} onChange={(event) => setSelectedKeys(event.target.checked ? [...new Set([...selectedKeys, ...rowKeys])] : selectedKeys.filter((key) => !rowKeys.includes(key)))} type="checkbox" /></th> : null}
              {visibleColumns.map((column) => (
                <th
                  className={cn(
                    cellPadding,
                    column.align === "center" && "text-center",
                    column.align === "right" && "text-right",
                    column.className,
                    column.sticky && "sticky left-0 z-10 bg-[#f4f8fa]",
                  )}
                  key={column.key}
                >
                  {column.sortable ? <Link className="inline-flex items-center gap-1 hover:text-foreground" href={sortHref(column)}>{column.label}{sortKey === column.key ? sortDirection === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" /> : null}</Link> : column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr className="border-t border-border/80 hover:bg-[#f8fbfc]" key={rowKeys[index]}>
                {selectable ? <td className={cellPadding}><input aria-label={`选择第 ${index + 1} 行`} checked={selectedKeys.includes(rowKeys[index])} onChange={(event) => setSelectedKeys((current) => event.target.checked ? [...current, rowKeys[index]] : current.filter((key) => key !== rowKeys[index]))} type="checkbox" /></td> : null}
                {visibleColumns.map((column) => (
                  <td
                    className={cn(
                      cellPadding,
                      "text-[#385064]",
                      column.align === "center" && "text-center",
                      column.align === "right" && "text-right",
                      column.className,
                      column.sticky && "sticky left-0 bg-white group-hover:bg-[#f8fbfc]",
                    )}
                    key={column.key}
                  >
                    {row[column.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="divide-y divide-border md:hidden">{rows.map((row, index) => <article className="space-y-3 p-4" key={rowKeys[index]}>{selectable ? <label className="flex items-center gap-2 text-[10px] text-muted-foreground"><input checked={selectedKeys.includes(rowKeys[index])} onChange={(event) => setSelectedKeys((current) => event.target.checked ? [...current, rowKeys[index]] : current.filter((key) => key !== rowKeys[index]))} type="checkbox" />选择该项</label> : null}{visibleColumns.filter((column) => !column.hideOnMobile).map((column) => <div className="grid grid-cols-[90px_1fr] gap-3 text-[10px]" key={column.key}><span className="text-muted-foreground">{column.label}</span><div className={cn("min-w-0 text-[#385064]", column.align === "right" && "text-right")}>{row[column.key]}</div></div>)}</article>)}</div>
      {!rows.length && (
        <div className="grid min-h-52 place-items-center text-center">
          <div>
            <Inbox className="mx-auto size-6 text-[#9aabb7]" />
            <div className="mt-3 text-xs font-medium">{emptyTitle}</div>
            <p className="mt-1 text-[10px] text-muted-foreground">{emptyDescription}</p>
          </div>
        </div>
      )}
      <footer className="flex items-center justify-between border-t border-border px-4 py-3 text-[10px] text-muted-foreground">
        <span>共 {total} 条 · 第 {page}/{totalPages} 页</span>
        <div className="flex gap-2">
          <Link
            aria-disabled={page <= 1}
            className={cn("grid size-8 place-items-center rounded-lg border border-border", page <= 1 && "pointer-events-none opacity-35")}
            href={pageHref(pathname, searchParams, Math.max(1, page - 1))}
          >
            <ChevronLeft className="size-3.5" />
          </Link>
          <Link
            aria-disabled={page >= totalPages}
            className={cn("grid size-8 place-items-center rounded-lg border border-border", page >= totalPages && "pointer-events-none opacity-35")}
            href={pageHref(pathname, searchParams, Math.min(totalPages, page + 1))}
          >
            <ChevronRight className="size-3.5" />
          </Link>
        </div>
      </footer>
    </section>
  );
}
