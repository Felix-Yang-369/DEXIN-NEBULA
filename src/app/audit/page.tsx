import type { Metadata } from "next";
import Link from "next/link";
import { FileClock, LockKeyhole, ScrollText, ShieldCheck } from "lucide-react";
import { WorkflowShell } from "@/features/approvals/workflow-shell";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "操作审计",
  description: "德馨星云关键业务操作审计记录",
};

export const dynamic = "force-dynamic";

type AuditRow = {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  summary: string;
  metadata: Record<string, unknown>;
  created_at: string;
  actor:
    | { name: string; employee_no: string }
    | Array<{ name: string; employee_no: string }>
    | null;
};

const actionLabels: Record<string, string> = {
  submitted: "提交",
  approved: "同意",
  department_approved: "部门审批通过",
  chairman_approved: "董事长审批通过",
  hr_filed: "人事备案",
  returned: "退回",
  rejected: "驳回",
  withdrawn: "撤回",
  resubmitted: "重新提交",
  employee_roles_updated: "角色变更",
  permission_template_published: "权限模板发布",
};

const roleLabels: Record<string, string> = {
  employee: "普通员工",
  department_lead: "部门负责人",
  hr: "人事行政",
  finance: "财务",
  admin: "系统管理员",
  chairman: "董事长",
};

function actorName(row: AuditRow) {
  const actor = Array.isArray(row.actor) ? row.actor[0] : row.actor;
  return actor?.name ?? "系统或已离职员工";
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function roleList(value: unknown) {
  return Array.isArray(value)
    ? value.map((role) => roleLabels[String(role)] ?? String(role)).join("、")
    : "—";
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const employee = await requireCurrentEmployee();
  const canView = employee.roleCodes.includes("admin");
  const params = await searchParams;
  const category = params.category === "roles" ? "roles" : "all";
  const supabase = await createClient();
  let query = supabase
    .from("audit_logs")
    .select(
      "id, action, entity_type, entity_id, summary, metadata, created_at, actor:employees!audit_logs_actor_employee_id_fkey(name, employee_no)",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (category === "roles") {
    query = query.in("action", [
      "employee_roles_updated",
      "highest_admin_roles_granted",
      "permission_template_published",
    ]);
  }

  const { data, error } = canView
    ? await query
    : { data: [], error: null };

  const logs = (data ?? []) as AuditRow[];

  return (
    <WorkflowShell
      activeItem="系统管理"
      breadcrumb="系统管理 / 操作审计"
      currentUser={{
        name: employee.name,
        roleLabel: employee.title ?? "内部员工",
      }}
    >
      <main className="mx-auto max-w-[1600px] p-4 sm:p-6 xl:p-8">
        <section className="relative overflow-hidden rounded-[24px] bg-[#0a385d] px-6 py-7 text-white shadow-[0_18px_50px_-32px_rgba(12,47,41,.75)] sm:px-8 lg:px-10">
          <ScrollText className="pointer-events-none absolute right-12 top-1/2 hidden size-40 -translate-y-1/2 text-white/[0.055] sm:block" />
          <div className="relative">
            <div className="text-xs font-medium tracking-[0.12em] text-[#79d8d5]">
              SECURITY AUDIT
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-[-0.035em] sm:text-[30px]">
              操作审计
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-white/55">
              记录关键审批动作、操作人员和状态变化。审计记录由数据库生成，普通业务页面不能修改。
            </p>
          </div>
        </section>

        {!canView ? (
          <section className="mt-5 rounded-[22px] border border-[#ead8d8] bg-white p-8 text-center">
            <LockKeyhole className="mx-auto size-8 text-[#965151]" />
            <h2 className="mt-4 text-base font-semibold">无权查看审计日志</h2>
            <p className="mt-2 text-xs text-muted-foreground">
              当前仅系统管理员可以查看公司级审计记录。
            </p>
          </section>
        ) : (
          <>
            <section className="mt-5 grid gap-3 sm:grid-cols-3">
              {[
                {
                  label: "最近记录",
                  value: logs.length,
                  icon: FileClock,
                  note: "最多显示最近 100 条",
                },
                {
                  label: "审批对象",
                  value: new Set(logs.map((item) => item.entity_id)).size,
                  icon: ScrollText,
                  note: "按申请对象去重",
                },
                {
                  label: "安全策略",
                  value: "只读",
                  icon: ShieldCheck,
                  note: "仅管理员可查看",
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
                      <span className="grid size-10 place-items-center rounded-xl bg-[#eaf3f8] text-primary">
                        <Icon className="size-[17px]" />
                      </span>
                    </div>
                    <div className="mt-4 border-t border-border/80 pt-3 text-[10px] text-muted-foreground">
                      {item.note}
                    </div>
                  </article>
                );
              })}
            </section>

            {error && (
              <div className="mt-5 rounded-xl border border-[#ead8d8] bg-[#f8eeee] px-4 py-3 text-xs text-[#965151]">
                无法读取审计记录，请确认第十个数据库迁移已经执行。
              </div>
            )}

            <section className="mt-5 overflow-hidden rounded-[22px] border border-border/80 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 px-5 py-5 sm:px-6">
                <div>
                  <h2 className="text-base font-semibold">
                    {category === "roles"
                      ? "角色与权限变更"
                      : "关键操作记录"}
                  </h2>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    审计记录只读，不记录业务敏感正文
                  </p>
                </div>
                <div className="flex rounded-xl bg-[#f3f7fa] p-1 text-[10px]">
                  <Link
                    className={`rounded-lg px-3 py-1.5 ${category === "all" ? "bg-white font-medium text-primary shadow-sm" : "text-muted-foreground"}`}
                    href="/audit"
                  >
                    全部
                  </Link>
                  <Link
                    className={`rounded-lg px-3 py-1.5 ${category === "roles" ? "bg-white font-medium text-primary shadow-sm" : "text-muted-foreground"}`}
                    href="/audit?category=roles"
                  >
                    角色权限
                  </Link>
                </div>
              </div>
              {logs.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  暂无审计记录
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[780px] text-left">
                    <thead className="bg-[#f3f7fa] text-[10px] text-muted-foreground">
                      <tr>
                        <th className="px-5 py-3 font-medium">时间</th>
                        <th className="px-5 py-3 font-medium">操作人</th>
                        <th className="px-5 py-3 font-medium">动作</th>
                        <th className="px-5 py-3 font-medium">对象</th>
                        <th className="px-5 py-3 font-medium">状态变化</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/70 text-xs">
                      {logs.map((log) => (
                        <tr key={log.id}>
                          <td className="whitespace-nowrap px-5 py-4 text-[10px] text-muted-foreground">
                            {formatDateTime(log.created_at)}
                          </td>
                          <td className="px-5 py-4 font-medium">
                            {actorName(log)}
                          </td>
                          <td className="px-5 py-4">
                            {actionLabels[log.action] ?? log.action}
                          </td>
                          <td className="px-5 py-4 text-muted-foreground">
                            {log.action === "employee_roles_updated"
                              ? `员工角色 · ${String(log.metadata.target_name ?? "未知员工")}`
                              : log.action === "permission_template_published"
                                ? "权限模板"
                                : log.entity_type === "leave_request"
                                  ? "请假申请"
                                  : "通用审批"}
                          </td>
                          <td className="px-5 py-4 text-[10px] text-muted-foreground">
                            {log.action === "employee_roles_updated" ? (
                              <>
                                {roleList(log.metadata.before)} →{" "}
                                {roleList(log.metadata.after)}
                                {log.metadata.high_risk === true && (
                                  <span className="ml-2 rounded-full bg-[#fff4e7] px-2 py-0.5 text-[#9a6321]">
                                    高危
                                  </span>
                                )}
                              </>
                            ) : (
                              <>
                                {String(log.metadata.previous_status ?? "—")} →{" "}
                                {String(log.metadata.next_status ?? "—")}
                              </>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </WorkflowShell>
  );
}
