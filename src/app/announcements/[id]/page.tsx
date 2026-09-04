import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Megaphone,
  Pin,
  UserRound,
  UsersRound,
} from "lucide-react";
import { WorkflowShell } from "@/features/approvals/workflow-shell";
import {
  announcementCategories,
  type AnnouncementRow,
} from "@/features/announcements/announcement-data";
import { AnnouncementReadReceipt } from "@/features/announcements/announcement-read-receipt";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "公告详情",
  description: "德馨淼盛内部公告详情",
};

export const dynamic = "force-dynamic";

function formatDateTime(value: string | null) {
  if (!value) return "尚未发布";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function renderTextWithLinks(text: string) {
  return text.split(/(https?:\/\/[^\s]+)/g).map((part, index) =>
    part.startsWith("http://") || part.startsWith("https://") ? (
      <a
        className="font-medium text-primary underline decoration-primary/25 underline-offset-4"
        href={part}
        key={`${index}-${part}`}
        rel="noreferrer"
        target="_blank"
      >
        {part}
      </a>
    ) : (
      part
    ),
  );
}

export default async function AnnouncementDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ published?: string }>;
}) {
  const employee = await requireCurrentEmployee();
  const { id } = await params;
  const feedback = await searchParams;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("announcements")
    .select(
      "id, title, summary, content, category_code, scope_type, scope_department_id, status, is_pinned, author_employee_id, author_name, published_at, created_at, updated_at, scopeDepartment:departments!announcements_scope_department_id_fkey(name)",
    )
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();

  if (error || !data) notFound();
  const announcement = data as AnnouncementRow;
  const meta = announcementCategories[announcement.category_code];
  const department = Array.isArray(announcement.scopeDepartment)
    ? announcement.scopeDepartment[0]
    : announcement.scopeDepartment;

  return (
    <WorkflowShell
      activeItem="协同工作台"
      breadcrumb={`协同办公 / 协同工作台 / 公告 / ${announcement.title}`}
      currentUser={{
        name: employee.name,
        roleLabel: employee.title ?? "内部员工",
      }}
    >
      <AnnouncementReadReceipt announcementId={announcement.id} />
      <main className="mx-auto max-w-[1200px] p-4 sm:p-6 xl:p-8">
        <Link
          className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-white px-3 text-xs font-medium text-muted-foreground"
          href="/announcements"
        >
          <ArrowLeft className="size-3.5" />
          返回公告中心
        </Link>

        {feedback.published === "1" && (
          <div className="mt-4 rounded-md border border-border bg-muted px-4 py-3 text-xs text-primary">
            公告已正式发布，站内通知已经按可见范围生成。
          </div>
        )}

        <article className="mt-4 overflow-hidden rounded-md border border-border/80 bg-white ">
          <header className="relative overflow-hidden bg-primary px-6 py-8 text-white sm:px-10 sm:py-10">
            <Megaphone className="pointer-events-none absolute right-10 top-1/2 hidden size-40 -translate-y-1/2 text-white/[0.05] sm:block" />
            <div className="relative max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                {announcement.is_pinned && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-foreground">
                    <Pin className="size-3" />
                    置顶公告
                  </span>
                )}
                <span className={`rounded-full px-3 py-1.5 text-xs font-medium ${meta.tone}`}>
                  {meta.label}
                </span>
              </div>
              <h1 className="mt-6 text-2xl font-semibold tracking-[-0.04em] sm:text-4xl">
                {announcement.title}
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/58">
                {announcement.summary}
              </p>
            </div>
          </header>

          <div className="grid gap-8 px-6 py-8 sm:px-10 lg:grid-cols-[minmax(0,1fr)_240px]">
            <div className="min-w-0">
              {announcement.content
                .split(/\n{2,}/)
                .map((paragraph) => paragraph.trim())
                .filter(Boolean)
                .map((paragraph, index) => (
                  <p
                    className="mt-0 mb-5 whitespace-pre-wrap text-[13px] leading-8 text-foreground sm:text-sm"
                    key={`${index}-${paragraph.slice(0, 18)}`}
                  >
                    {renderTextWithLinks(paragraph)}
                  </p>
                ))}
            </div>
            <aside className="space-y-4 border-t border-border pt-6 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
              {[
                [UserRound, "发布人", announcement.author_name],
                [CalendarDays, "发布时间", formatDateTime(announcement.published_at)],
                [
                  UsersRound,
                  "可见范围",
                  announcement.scope_type === "all"
                    ? "全体员工"
                    : department?.name ?? "指定部门",
                ],
              ].map(([Icon, label, value]) => {
                const MetaIcon = Icon as typeof UserRound;
                return (
                  <div className="flex gap-3" key={String(label)}>
                    <span className="grid size-8 shrink-0 place-items-center rounded-md bg-muted text-primary">
                      <MetaIcon className="size-3.5" />
                    </span>
                    <div>
                      <div className="text-xs text-muted-foreground">{String(label)}</div>
                      <div className="mt-1 text-xs font-medium text-foreground">
                        {String(value)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </aside>
          </div>
        </article>
      </main>
    </WorkflowShell>
  );
}
