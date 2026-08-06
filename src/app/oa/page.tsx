import type { Metadata } from "next";
import Link from "next/link";
import {
  BellRing,
  BookOpenText,
  ChevronRight,
  ClipboardCheck,
  Files,
  Megaphone,
  NotebookPen,
  PanelsTopLeft,
  ReceiptText,
  Stamp,
} from "lucide-react";
import { WorkflowShell } from "@/features/approvals/workflow-shell";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "协同办公 OA",
  description: "德馨星云审批、公告、消息、周报、制度和文件协同门户",
};

export const dynamic = "force-dynamic";

const oaModules = [
  {
    title: "统一审批",
    english: "BPM",
    description: "请假、报销、用印等申请集中处理",
    href: "/approvals",
    icon: ClipboardCheck,
  },
  {
    title: "公告通知",
    english: "Announcement",
    description: "公司公告、制度发布与阅读回执",
    href: "/announcements",
    icon: Megaphone,
  },
  {
    title: "消息中心",
    english: "Notification",
    description: "审批待办和业务状态变化提醒",
    href: "/notifications",
    icon: BellRing,
  },
  {
    title: "周报管理",
    english: "Weekly Report",
    description: "员工周报、团队汇总与历史记录",
    href: "/reports/weekly",
    icon: NotebookPen,
  },
  {
    title: "制度与知识",
    english: "Knowledge",
    description: "制度、SOP 和内部知识检索",
    href: "/knowledge",
    icon: BookOpenText,
  },
  {
    title: "文件中心",
    english: "Document",
    description: "合同、客户、供应商与内部文件",
    href: "/documents",
    icon: Files,
  },
] as const;

export default async function OaPage() {
  const employee = await requireCurrentEmployee();
  const supabase = await createClient();
  const [
    leavePendingResult,
    approvalPendingResult,
    unreadNotificationResult,
    announcementResult,
    announcementReadResult,
    weeklyResult,
    knowledgeResult,
    documentResult,
  ] = await Promise.all([
    supabase
      .from("leave_requests")
      .select("id", { count: "exact", head: true })
      .eq("current_approver_employee_id", employee.id)
      .in("status", [
        "pending_department",
        "pending_chairman",
        "pending_hr_filing",
      ]),
    supabase
      .from("approval_requests")
      .select("id", { count: "exact", head: true })
      .eq("current_approver_employee_id", employee.id)
      .eq("status", "pending"),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .is("read_at", null),
    supabase.from("announcements").select("id").eq("status", "published"),
    supabase
      .from("announcement_reads")
      .select("announcement_id")
      .eq("employee_id", employee.id),
    supabase
      .from("weekly_reports")
      .select("id, week_start, status")
      .eq("employee_id", employee.id)
      .order("week_start", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("knowledge_documents")
      .select("id", { count: "exact", head: true })
      .eq("status", "published"),
    supabase
      .from("business_documents")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
  ]);

  const pendingCount =
    (leavePendingResult.count ?? 0) + (approvalPendingResult.count ?? 0);
  const readAnnouncementIds = new Set(
    (announcementReadResult.data ?? []).map((item) => item.announcement_id),
  );
  const unreadAnnouncements = (announcementResult.data ?? []).filter(
    (item) => !readAnnouncementIds.has(item.id),
  ).length;
  const latestWeekly = weeklyResult.data;

  return (
    <WorkflowShell
      activeItem="协同办公"
      breadcrumb="协同办公 / OA 门户"
      currentUser={{
        name: employee.name,
        roleLabel: employee.title ?? "内部员工",
      }}
    >
      <main className="mx-auto max-w-[1500px] p-4 sm:p-6 xl:p-8">
        <section className="relative overflow-hidden rounded-[24px] bg-[#0a385d] px-6 py-8 text-white sm:px-8 lg:px-10">
          <PanelsTopLeft className="absolute right-12 top-1/2 hidden size-40 -translate-y-1/2 text-white/[0.05] sm:block" />
          <div className="relative">
            <div className="text-[10px] font-medium tracking-[0.16em] text-[#79d8d5]">
              OA · OFFICE AUTOMATION
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-[-0.035em] sm:text-[30px]">
              协同办公
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-white/55">
              将审批、公告、消息、周报、制度和文件集中到一个工作门户，让日常协同有入口、有进度、有记录。
            </p>
          </div>
        </section>

        <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {[
            [pendingCount, "我的待审批", "需要当前账号处理"],
            [unreadNotificationResult.count ?? 0, "未读消息", "业务与流程提醒"],
            [unreadAnnouncements, "未读公告", "可见范围内公告"],
            [
              latestWeekly?.status === "submitted" ? "已提交" : "待提交",
              "最近周报",
              latestWeekly?.week_start ?? "尚未创建",
            ],
            [documentResult.count ?? 0, "可访问文件", "按权限统计"],
          ].map(([value, label, note]) => (
            <article
              className="rounded-[18px] border border-border/75 bg-white p-5"
              key={String(label)}
            >
              <div className="text-xl font-semibold">{value}</div>
              <div className="mt-2 text-xs font-medium">{label}</div>
              <div className="mt-1 text-[9px] text-muted-foreground">{note}</div>
            </article>
          ))}
        </section>

        <section className="mt-7">
          <h2 className="text-sm font-semibold">OA 应用</h2>
          <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {oaModules.map((module) => {
              const Icon = module.icon;
              return (
                <Link
                  className="group rounded-[20px] border border-border/75 bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-[0_14px_35px_-28px_rgba(16,62,53,.55)]"
                  href={module.href}
                  key={module.title}
                >
                  <div className="flex items-start justify-between">
                    <span className="grid size-10 place-items-center rounded-xl bg-[#eaf3f8] text-primary">
                      <Icon className="size-5" />
                    </span>
                    <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </div>
                  <div className="mt-4 text-[9px] font-medium tracking-[0.12em] text-primary/55">
                    {module.english}
                  </div>
                  <h3 className="mt-1 text-sm font-semibold">{module.title}</h3>
                  <p className="mt-2 text-[10px] leading-5 text-muted-foreground">
                    {module.description}
                  </p>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="mt-7 grid gap-4 md:grid-cols-3">
          {[
            {
              title: "请假申请",
              description: "填写请假类型、日期、原因和工作交接",
              href: "/requests/leave",
              icon: ClipboardCheck,
            },
            {
              title: "费用报销",
              description: "提交费用明细并进入负责人和财务审批",
              href: "/requests/expense",
              icon: ReceiptText,
            },
            {
              title: "用印申请",
              description: "申请公章、合同章、财务章及外带登记",
              href: "/requests/seal",
              icon: Stamp,
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <Link
                className="flex items-center gap-4 rounded-[18px] border border-border bg-[#eef4f8] p-4"
                href={item.href}
                key={item.title}
              >
                <span className="grid size-9 place-items-center rounded-xl bg-white text-primary">
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-xs font-semibold">{item.title}</h3>
                  <p className="mt-1 truncate text-[9px] text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              </Link>
            );
          })}
        </section>

        <div className="mt-5 rounded-xl border border-border bg-white px-4 py-3 text-[10px] text-muted-foreground">
          当前制度与知识库共 {knowledgeResult.count ?? 0} 份已发布资料。OA
          只负责协同入口，员工主档和假期账户仍归 HRM，付款与凭证仍归 FMS。
        </div>
      </main>
    </WorkflowShell>
  );
}
