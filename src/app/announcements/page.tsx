import type { Metadata } from "next";
import Link from "next/link";
import {
  BellRing,
  FileClock,
  Megaphone,
  PenLine,
  Pin,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { WorkflowShell } from "@/features/approvals/workflow-shell";
import { AnnouncementList } from "@/features/announcements/announcement-list";
import type { AnnouncementRow } from "@/features/announcements/announcement-data";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "公告中心",
  description: "德馨淼盛公司公告、制度提醒与内部通知",
};

export const dynamic = "force-dynamic";

export default async function AnnouncementsPage() {
  const employee = await requireCurrentEmployee();
  const canPublish = employee.roleCodes.some((role) =>
    ["hr", "admin"].includes(role),
  );
  const supabase = await createClient();
  const [{ data, error }, { data: readData }] = await Promise.all([
    supabase
      .from("announcements")
      .select(
        "id, title, summary, content, category_code, scope_type, scope_department_id, status, is_pinned, author_employee_id, author_name, published_at, created_at, updated_at, scopeDepartment:departments!announcements_scope_department_id_fkey(name)",
      )
      .order("is_pinned", { ascending: false })
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("announcement_reads").select("announcement_id").limit(500),
  ]);

  const announcements = (data ?? []) as AnnouncementRow[];
  const readIds = (readData ?? []).map((item) => item.announcement_id);
  const published = announcements.filter((item) => item.status === "published");
  const readSet = new Set(readIds);
  const stats = [
    {
      label: "已发布",
      value: published.length,
      note: "当前账号有权查看",
      icon: Megaphone,
      tone: "bg-muted text-foreground",
    },
    {
      label: "未读",
      value: published.filter((item) => !readSet.has(item.id)).length,
      note: "打开详情后自动标记",
      icon: BellRing,
      tone: "bg-muted text-foreground",
    },
    {
      label: "置顶",
      value: published.filter((item) => item.is_pinned).length,
      note: "优先展示重要通知",
      icon: Pin,
      tone: "bg-muted text-foreground",
    },
    {
      label: "草稿",
      value: canPublish
        ? announcements.filter((item) => item.status === "draft").length
        : 0,
      note: canPublish ? "仅发布人员可见" : "无发布权限",
      icon: FileClock,
      tone: "bg-muted text-foreground",
    },
  ];

  return (
    <WorkflowShell
      activeItem="协同工作台"
      breadcrumb="协同办公 / 协同工作台 / 公告"
      currentUser={{
        name: employee.name,
        roleLabel: employee.title ?? "内部员工",
      }}
    >
      <main className="mx-auto max-w-[1440px] p-4 sm:p-6 xl:p-8">
        <section className="ui-page-header">
          <div className="absolute -right-16 -top-24 size-72 rounded-full border border-white/8" />
          <Megaphone className="pointer-events-none absolute right-12 top-1/2 hidden size-40 -translate-y-1/2 text-white/[0.055] sm:block" />
          <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <div className="text-xs font-medium tracking-[0.12em] text-muted-foreground">
                ANNOUNCEMENT CENTER
              </div>
              <h1 className="mt-3 text-2xl font-semibold tracking-[-0.035em] sm:text-[30px]">
                公告中心
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/55">
                集中发布公司通知、制度提醒和项目动态，并按照全员或指定部门控制可见范围。
              </p>
            </div>
            {canPublish ? (
              <Link
                className="inline-flex h-10 w-fit items-center gap-2 rounded-md bg-muted px-4 text-xs font-medium text-foreground"
                href="/announcements/new"
              >
                <PenLine className="size-4" />
                新建公告
              </Link>
            ) : (
              <span className="inline-flex h-10 w-fit items-center rounded-md border border-white/14 bg-white/8 px-4 text-xs text-white/65">
                当前账号为阅读权限
              </span>
            )}
          </div>
        </section>

        <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <article
                className="rounded-md border border-border/80 bg-white p-5 "
                key={stat.label}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xs text-muted-foreground">{stat.label}</div>
                    <div className="mt-3 text-[28px] font-semibold tracking-[-0.04em]">
                      {stat.value}
                    </div>
                  </div>
                  <span className={`grid size-10 place-items-center rounded-md ${stat.tone}`}>
                    <Icon className="size-[17px]" />
                  </span>
                </div>
                <div className="mt-4 border-t border-border/80 pt-3 text-xs text-muted-foreground">
                  {stat.note}
                </div>
              </article>
            );
          })}
        </section>

        {error ? (
          <section className="mt-5 rounded-md border border-border bg-muted px-6 py-12 text-center text-foreground">
            <Megaphone className="mx-auto size-7" />
            <h2 className="mt-4 text-sm font-semibold">暂时无法读取公告数据</h2>
            <p className="mt-2 text-xs text-foreground">
              请确认第十三个数据库迁移已经执行。
            </p>
          </section>
        ) : (
          <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
            <section className="overflow-hidden rounded-md border border-border/80 bg-white">
              <div className="px-5 pt-5 sm:px-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-base font-semibold">公告列表</h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      数据和可见范围来自 Supabase 当前登录账号
                    </p>
                  </div>
                  <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-primary">
                    {announcements.length} 条
                  </span>
                </div>
              </div>
              <AnnouncementList
                canPublish={canPublish}
                items={announcements}
                readIds={readIds}
              />
            </section>

            <aside className="space-y-5">
              <section className="rounded-md border border-border/80 bg-white p-5">
                <div className="flex items-center gap-2">
                  <UsersRound className="size-4 text-primary" />
                  <h2 className="text-sm font-semibold">发布范围</h2>
                </div>
                <div className="mt-5 space-y-4">
                  {[
                    ["全体员工", "公司级公告和统一制度通知"],
                    ["指定部门", "仅所选部门成员和管理人员可见"],
                  ].map(([title, copy], index) => (
                    <div className="flex gap-3" key={title}>
                      <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-muted text-xs font-semibold text-primary">
                        0{index + 1}
                      </span>
                      <div>
                        <div className="text-xs font-semibold">{title}</div>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          {copy}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-md bg-primary p-5 text-white">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold">权限与留痕</h2>
                </div>
                <ul className="mt-4 space-y-3 text-xs leading-5 text-white/58">
                  <li>● 人事或管理员可以创建和发布公告。</li>
                  <li>● 员工草稿不可见，发布后按范围通知。</li>
                  <li>● 每个账号独立记录已读状态。</li>
                  <li>● 正式发布动作写入审计日志。</li>
                </ul>
              </section>
            </aside>
          </div>
        )}
      </main>
    </WorkflowShell>
  );
}
