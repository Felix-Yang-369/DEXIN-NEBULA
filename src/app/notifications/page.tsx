import type { Metadata } from "next";
import {
  BellRing,
  CheckCheck,
  CircleCheck,
  Clock3,
  Inbox,
} from "lucide-react";
import { WorkflowShell } from "@/features/approvals/workflow-shell";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import {
  readAllNotificationsAction,
  readNotificationAction,
} from "@/features/notifications/server-actions";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "消息中心",
  description: "德馨星云站内通知与审批提醒",
};

export const dynamic = "force-dynamic";

type NotificationRow = {
  id: string;
  notification_type: "approval_pending" | "request_updated" | "system";
  title: string;
  body: string;
  href: string | null;
  read_at: string | null;
  created_at: string;
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ updated?: string; error?: string }>;
}) {
  const employee = await requireCurrentEmployee();
  const feedback = await searchParams;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select(
      "id, notification_type, title, body, href, read_at, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  const notifications = (data ?? []) as NotificationRow[];
  const unread = notifications.filter((item) => !item.read_at);
  const approvalPending = notifications.filter(
    (item) => item.notification_type === "approval_pending" && !item.read_at,
  );

  return (
    <WorkflowShell
      activeItem="协同办公"
      breadcrumb="协同办公 / 消息中心"
      currentUser={{
        name: employee.name,
        roleLabel: employee.title ?? "内部员工",
      }}
    >
      <main className="mx-auto max-w-[1600px] p-4 sm:p-6 xl:p-8">
        <section className="relative overflow-hidden rounded-[24px] bg-[#0a385d] px-6 py-7 text-white shadow-[0_18px_50px_-32px_rgba(12,47,41,.75)] sm:px-8 lg:px-10">
          <BellRing className="pointer-events-none absolute right-12 top-1/2 hidden size-40 -translate-y-1/2 text-white/[0.055] sm:block" />
          <div className="relative flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <div className="text-xs font-medium tracking-[0.12em] text-[#79d8d5]">
                NOTIFICATION CENTER
              </div>
              <h1 className="mt-3 text-2xl font-semibold tracking-[-0.035em] sm:text-[30px]">
                消息中心
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/55">
                接收审批待办和申请状态变化提醒。消息范围严格绑定当前员工账号。
              </p>
            </div>
            {unread.length > 0 && (
              <form action={readAllNotificationsAction}>
                <button
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#6bd7d4] px-4 text-xs font-medium text-[#0b3152]"
                  type="submit"
                >
                  <CheckCheck className="size-4" />
                  全部标为已读
                </button>
              </form>
            )}
          </div>
        </section>

        <section className="mt-5 grid gap-3 sm:grid-cols-3">
          {[
            {
              label: "全部消息",
              value: notifications.length,
              icon: Inbox,
              tone: "bg-[#edf2f7] text-[#42647a]",
            },
            {
              label: "未读消息",
              value: unread.length,
              icon: Clock3,
              tone: "bg-[#fff4e7] text-[#9a6321]",
            },
            {
              label: "待审批提醒",
              value: approvalPending.length,
              icon: BellRing,
              tone: "bg-[#eaf3f8] text-[#0d6c78]",
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <article
                className="rounded-[20px] border border-border/80 bg-white p-5"
                key={item.label}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xs text-muted-foreground">
                      {item.label}
                    </div>
                    <div className="mt-3 text-[28px] font-semibold">
                      {item.value}
                    </div>
                  </div>
                  <span
                    className={`grid size-10 place-items-center rounded-xl ${item.tone}`}
                  >
                    <Icon className="size-[17px]" />
                  </span>
                </div>
              </article>
            );
          })}
        </section>

        {feedback.updated === "1" && (
          <div className="mt-5 rounded-xl border border-[#d8e8ee] bg-[#eef4f8] px-4 py-3 text-xs text-primary">
            所有消息已标记为已读。
          </div>
        )}

        {(error || feedback.error) && (
          <div className="mt-5 rounded-xl border border-[#ead8d8] bg-[#f8eeee] px-4 py-3 text-xs text-[#965151]">
            无法读取消息，请确认第十个数据库迁移已经执行。
          </div>
        )}

        <section className="mt-5 rounded-[22px] border border-border/80 bg-white p-5 sm:p-6">
          <div>
            <h2 className="text-base font-semibold">最近消息</h2>
            <p className="mt-1 text-[10px] text-muted-foreground">
              最多展示最近 100 条，仅当前账号可见
            </p>
          </div>

          {notifications.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-border bg-[#fafcfe] py-12 text-center">
              <CircleCheck className="mx-auto size-7 text-primary" />
              <div className="mt-3 text-xs font-medium">暂时没有消息</div>
            </div>
          ) : (
            <div className="mt-5 divide-y divide-border/70">
              {notifications.map((notification) => (
                <article
                  className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center"
                  key={notification.id}
                >
                  <span
                    className={`mt-1 size-2 shrink-0 rounded-full ${
                      notification.read_at ? "bg-border" : "bg-[#d88163]"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-medium">
                        {notification.title}
                      </h3>
                      {!notification.read_at && (
                        <span className="rounded-full bg-[#fff4e7] px-2 py-0.5 text-[9px] text-[#9a6321]">
                          未读
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {notification.body}
                    </p>
                    <div className="mt-1 text-[9px] text-muted-foreground/70">
                      {formatDateTime(notification.created_at)}
                    </div>
                  </div>
                  {notification.read_at ? (
                    <span className="text-[10px] text-muted-foreground">
                      已读
                    </span>
                  ) : (
                    <form action={readNotificationAction}>
                      <input
                        name="notificationId"
                        type="hidden"
                        value={notification.id}
                      />
                      <input
                        name="href"
                        type="hidden"
                        value={notification.href ?? "/notifications"}
                      />
                      <button
                        className="h-9 rounded-xl bg-primary px-4 text-[10px] font-medium text-primary-foreground"
                        type="submit"
                      >
                        查看并标记已读
                      </button>
                    </form>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </WorkflowShell>
  );
}
