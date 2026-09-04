"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  BellRing,
  CalendarDays,
  FileClock,
  Pin,
  Search,
  UsersRound,
} from "lucide-react";
import {
  announcementCategories,
  type AnnouncementCategory,
  type AnnouncementRow,
} from "./announcement-data";

function formatDateTime(value: string | null) {
  if (!value) return "尚未发布";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function departmentName(announcement: AnnouncementRow) {
  const department = Array.isArray(announcement.scopeDepartment)
    ? announcement.scopeDepartment[0]
    : announcement.scopeDepartment;
  return department?.name ?? "指定部门";
}

export function AnnouncementList({
  items,
  readIds,
  canPublish,
}: {
  items: AnnouncementRow[];
  readIds: string[];
  canPublish: boolean;
}) {
  const [category, setCategory] = useState<AnnouncementCategory | "all">("all");
  const [keyword, setKeyword] = useState("");
  const readSet = useMemo(() => new Set(readIds), [readIds]);

  const filteredItems = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLocaleLowerCase("zh-CN");

    return items.filter((item) => {
      const matchesCategory =
        category === "all" || item.category_code === category;
      const matchesKeyword =
        normalizedKeyword.length === 0 ||
        `${item.title}${item.summary}${item.content}${item.author_name}`
          .toLocaleLowerCase("zh-CN")
          .includes(normalizedKeyword);

      return matchesCategory && matchesKeyword;
    });
  }, [category, items, keyword]);

  return (
    <>
      <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:px-6 lg:flex-row lg:items-center">
        <label className="relative block min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/65" />
          <input
            aria-label="搜索公告"
            className="h-10 w-full rounded-md border border-border bg-muted pl-10 pr-4 text-xs outline-none transition-colors placeholder:text-muted-foreground/55 focus:border-primary/35 focus:bg-white focus:ring-4 focus:ring-primary/7"
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索公告标题或内容"
            type="search"
            value={keyword}
          />
        </label>
        <div className="flex gap-2 overflow-x-auto pb-1 lg:pb-0">
          <button
            className={`h-9 shrink-0 rounded-md px-3 text-xs font-medium ${
              category === "all"
                ? "bg-primary text-white"
                : "border border-border text-muted-foreground"
            }`}
            onClick={() => setCategory("all")}
            type="button"
          >
            全部
          </button>
          {Object.entries(announcementCategories).map(([code, meta]) => (
            <button
              className={`h-9 shrink-0 rounded-md px-3 text-xs font-medium ${
                category === code
                  ? "bg-primary text-white"
                  : "border border-border text-muted-foreground"
              }`}
              key={code}
              onClick={() => setCategory(code as AnnouncementCategory)}
              type="button"
            >
              {meta.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        {filteredItems.length > 0 ? (
          filteredItems.map((item) => {
            const unread = item.status === "published" && !readSet.has(item.id);
            const meta = announcementCategories[item.category_code];
            const href =
              item.status === "draft"
                ? `/announcements/new?edit=${item.id}`
                : `/announcements/${item.id}`;

            return (
              <Link
                className="group block border-b border-border/80 px-5 py-5 transition-colors last:border-b-0 hover:bg-muted sm:px-6"
                href={href}
                key={item.id}
              >
                <div className="flex gap-4">
                  <div
                    className={`mt-1 grid size-10 shrink-0 place-items-center rounded-md ${
                      unread
                        ? "bg-muted text-primary"
                        : item.status === "draft"
                          ? "bg-muted text-foreground"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {item.status === "draft" ? (
                      <FileClock className="size-[17px]" />
                    ) : (
                      <BellRing className="size-[17px]" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {unread && (
                        <span className="size-1.5 rounded-full bg-muted" />
                      )}
                      {item.is_pinned && item.status === "published" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs font-medium text-foreground">
                          <Pin className="size-2.5" />
                          置顶
                        </span>
                      )}
                      {item.status === "draft" && canPublish && (
                        <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium text-foreground">
                          草稿
                        </span>
                      )}
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium ${meta.tone}`}
                      >
                        {meta.label}
                      </span>
                      <h3 className="text-sm font-semibold tracking-[-0.01em]">
                        {item.title}
                      </h3>
                    </div>
                    <p className="mt-2 max-w-4xl text-xs leading-6 text-muted-foreground">
                      {item.summary}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground/75">
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDays className="size-3" />
                        {formatDateTime(item.published_at ?? item.updated_at)}
                      </span>
                      <span>{item.author_name}</span>
                      <span className="inline-flex items-center gap-1.5">
                        <UsersRound className="size-3" />
                        {item.scope_type === "all"
                          ? "全体员工"
                          : departmentName(item)}
                      </span>
                    </div>
                  </div>
                  <span className="hidden self-center text-sm text-muted-foreground/30 transition-transform group-hover:translate-x-0.5 sm:block">
                    →
                  </span>
                </div>
              </Link>
            );
          })
        ) : (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto grid size-12 place-items-center rounded-lg bg-muted text-primary">
              <Search className="size-5" />
            </div>
            <h3 className="mt-4 text-sm font-semibold">没有找到相关公告</h3>
            <p className="mt-2 text-xs text-muted-foreground">
              当前还没有公告，或搜索条件没有匹配结果。
            </p>
          </div>
        )}
      </div>
    </>
  );
}
