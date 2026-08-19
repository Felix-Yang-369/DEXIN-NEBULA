import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  CheckCircle2,
  CircleAlert,
  CircleDashed,
  ClipboardCheck,
  Clock3,
  LockKeyhole,
  RotateCcw,
  UserRoundCheck,
  UserRoundX,
  X,
} from "lucide-react";
import { WorkflowShell } from "@/features/approvals/workflow-shell";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import {
  cancelEmployeeLifecycleCaseAction,
  createEmployeeLifecycleCaseAction,
  updateEmployeeLifecycleTaskAction,
} from "@/features/hr/lifecycle-server-actions";
import {
  isLifecycleTaskOverdue,
  lifecycleProgress,
  type LifecycleTaskStatus,
} from "@/features/hr/lifecycle";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "入职离职管理",
  description: "德馨星云员工入职、离职和事项交接清单",
};

export const dynamic = "force-dynamic";

type EmployeeOption = {
  id: string;
  employee_no: string;
  name: string;
  title: string | null;
  status: "active" | "inactive";
  employment_status: string;
};

type RelationName = { name: string };
type LifecycleTask = {
  id: string;
  task_code: string;
  title: string;
  category: string;
  due_on: string | null;
  status: LifecycleTaskStatus;
  note: string | null;
  sort_order: number;
  responsible: RelationName | RelationName[] | null;
};
type LifecycleCase = {
  id: string;
  case_no: string;
  process_type: "onboarding" | "offboarding";
  effective_on: string;
  status: "in_progress" | "completed" | "cancelled";
  note: string | null;
  completed_at: string | null;
  created_at: string;
  employee:
    | (EmployeeOption & { avatar_path: string | null })
    | Array<EmployeeOption & { avatar_path: string | null }>
    | null;
  owner: RelationName | RelationName[] | null;
  tasks: LifecycleTask[];
};

function today() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function one<T>(value: T | T[] | null) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function feedbackMessage(feedback: Record<string, string | undefined>) {
  if (feedback.created === "onboarding") return "入职清单已创建。";
  if (feedback.created === "offboarding") return "离职清单已创建。";
  if (feedback.updated) return "清单事项已更新。";
  if (feedback.cancelled) return "流程已取消。";
  const messages: Record<string, string> = {
    forbidden: "当前账号没有人事操作权限。",
    invalid_case: "请完整填写员工、流程日期和负责人。",
    active_case_exists: "该员工已有进行中的同类型流程。",
    create_failed: "创建失败，请稍后重试。",
    invalid_task: "清单操作参数无效。",
    task_failed: "事项更新失败，请稍后重试。",
    invalid_cancel: "请填写至少 2 个字的取消原因。",
    cancel_failed: "流程取消失败，请确认当前状态。",
  };
  return feedback.error ? messages[feedback.error] ?? "操作失败。" : null;
}

const categoryLabels: Record<string, string> = {
  profile: "人事资料",
  contract: "合同",
  account: "账号",
  asset: "资产",
  access: "权限",
  handover: "交接",
  training: "培训",
  finance: "财务",
  other: "其他",
};

export default async function EmployeeLifecyclePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const currentEmployee = await requireCurrentEmployee();
  const feedback = await searchParams;
  const canManage = currentEmployee.roleCodes.some((role) =>
    ["hr"].includes(role),
  );
  const canView =
    canManage || currentEmployee.roleCodes.includes("chairman");
  const supabase = await createClient();

  let employees: EmployeeOption[] = [];
  let cases: LifecycleCase[] = [];
  let loadError = false;

  if (canView) {
    const [employeesResult, casesResult] = await Promise.all([
      supabase
        .from("employees")
        .select(
          "id, employee_no, name, title, status, employment_status",
        )
        .not("employee_no", "like", "DX-DEV-%")
        .order("name"),
      supabase
        .from("employee_lifecycle_cases")
        .select(
          "id, case_no, process_type, effective_on, status, note, completed_at, created_at, employee:employees!employee_lifecycle_cases_employee_id_fkey(id, employee_no, name, title, status, employment_status, avatar_path), owner:employees!employee_lifecycle_cases_owner_employee_id_fkey(name), tasks:employee_lifecycle_tasks(id, task_code, title, category, due_on, status, note, sort_order, responsible:employees!employee_lifecycle_tasks_responsible_employee_id_fkey(name))",
        )
        .order("created_at", { ascending: false }),
    ]);

    employees = (employeesResult.data ?? []) as EmployeeOption[];
    cases = (casesResult.data ?? []) as unknown as LifecycleCase[];
    loadError = Boolean(employeesResult.error || casesResult.error);
  }

  const filter =
    feedback.type === "onboarding" || feedback.type === "offboarding"
      ? feedback.type
      : "all";
  const visibleCases = cases.filter(
    (item) => filter === "all" || item.process_type === filter,
  );
  const allTasks = cases.flatMap((item) => item.tasks ?? []);
  const activeCases = cases.filter((item) => item.status === "in_progress");
  const overdueTasks = allTasks.filter((task) =>
    isLifecycleTaskOverdue(task.due_on, task.status, today()),
  ).length;
  const totalProgress = lifecycleProgress(allTasks);
  const message = feedbackMessage(feedback);

  return (
    <WorkflowShell
      activeItem="人力资源"
      breadcrumb="组织运营 / 人力资源 / 入职离职"
      currentUser={{
        name: currentEmployee.name,
        roleLabel: currentEmployee.title ?? "内部员工",
      }}
    >
      <main className="mx-auto max-w-[1500px] p-4 sm:p-6 xl:p-8">
        <Link
          className="inline-flex items-center gap-2 text-[11px] text-muted-foreground hover:text-primary"
          href="/hr"
        >
          <ArrowLeft className="size-4" />
          返回 HRM 总览
        </Link>

        {!canView ? (
          <section className="mt-5 rounded-[22px] border border-[#ead8d8] bg-white p-12 text-center">
            <LockKeyhole className="mx-auto size-9 text-[#965151]" />
            <h1 className="mt-4 text-lg font-semibold">暂无模块访问权限</h1>
            <p className="mt-2 text-xs text-muted-foreground">
              入职离职清单包含人事和账号信息，仅向人事、管理员及董事长开放。
            </p>
          </section>
        ) : (
          <>
            <section className="relative mt-5 overflow-hidden rounded-[24px] bg-[#0a385d] px-6 py-8 text-white sm:px-8">
              <div className="absolute -right-16 -top-20 size-72 rounded-full border border-white/10" />
              <ClipboardCheck className="absolute right-10 top-1/2 hidden size-36 -translate-y-1/2 text-white/[0.06] md:block" />
              <div className="relative max-w-2xl">
                <div className="text-[10px] tracking-[0.16em] text-[#79d8d5]">
                  HRM · ONBOARDING & OFFBOARDING
                </div>
                <h1 className="mt-3 text-2xl font-semibold tracking-[-0.03em] sm:text-[30px]">
                  员工入职与离职
                </h1>
                <p className="mt-3 text-sm leading-7 text-white/55">
                  用标准清单衔接员工档案、合同、企业账号、系统权限、办公资产和工作交接，每一步均保留负责人、进度和审计记录。
                </p>
              </div>
            </section>

            {message && (
              <div
                className={`mt-4 rounded-xl border px-4 py-3 text-xs ${
                  feedback.error
                    ? "border-[#ead3d3] bg-[#fff7f7] text-[#914949]"
                    : "border-[#cfe6dc] bg-[#f1f8f5] text-primary"
                }`}
              >
                {message}
              </div>
            )}

            {loadError && (
              <div className="mt-4 rounded-xl border border-[#ead3d3] bg-[#fff7f7] px-4 py-3 text-xs text-[#914949]">
                无法读取入离职数据，请确认第三阶段 HRM 数据库迁移已经执行。
              </div>
            )}

            <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  value: activeCases.length,
                  label: "进行中流程",
                  icon: Clock3,
                },
                {
                  value: activeCases.filter(
                    (item) => item.process_type === "onboarding",
                  ).length,
                  label: "入职办理",
                  icon: UserRoundCheck,
                },
                {
                  value: overdueTasks,
                  label: "逾期事项",
                  icon: CircleAlert,
                },
                {
                  value: `${totalProgress.percent}%`,
                  label: "总体完成度",
                  icon: CheckCircle2,
                },
              ].map(({ value, label, icon: MetricIcon }) => {
                return (
                  <article
                    className="rounded-[18px] border border-border/75 bg-white p-5"
                    key={String(label)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-2xl font-semibold">{value}</div>
                      <span className="grid size-9 place-items-center rounded-xl bg-[#edf4f7] text-primary">
                        <MetricIcon className="size-4" />
                      </span>
                    </div>
                    <div className="mt-2 text-xs font-medium">{label}</div>
                  </article>
                );
              })}
            </section>

            {canManage && (
              <details className="mt-5 rounded-[20px] border border-border/75 bg-white p-5 open:shadow-[0_16px_40px_-34px_rgba(16,62,53,.45)]">
                <summary className="cursor-pointer list-none text-sm font-semibold">
                  + 创建入职或离职流程
                </summary>
                <form
                  action={createEmployeeLifecycleCaseAction}
                  className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5"
                >
                  <label className="grid gap-2 text-[10px] text-muted-foreground xl:col-span-2">
                    办理员工
                    <select
                      className="h-11 rounded-xl border border-border bg-white px-3 text-xs text-foreground"
                      name="employeeId"
                      required
                    >
                      <option value="">请选择员工</option>
                      {employees.map((employee) => (
                        <option key={employee.id} value={employee.id}>
                          {employee.name} · {employee.employee_no}
                          {employee.title ? ` · ${employee.title}` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-2 text-[10px] text-muted-foreground">
                    流程类型
                    <select
                      className="h-11 rounded-xl border border-border bg-white px-3 text-xs text-foreground"
                      name="processType"
                    >
                      <option value="onboarding">入职办理</option>
                      <option value="offboarding">离职办理</option>
                    </select>
                  </label>
                  <label className="grid gap-2 text-[10px] text-muted-foreground">
                    入职 / 离职日期
                    <input
                      className="h-11 rounded-xl border border-border px-3 text-xs text-foreground"
                      defaultValue={today()}
                      name="effectiveOn"
                      required
                      type="date"
                    />
                  </label>
                  <label className="grid gap-2 text-[10px] text-muted-foreground">
                    流程负责人
                    <select
                      className="h-11 rounded-xl border border-border bg-white px-3 text-xs text-foreground"
                      defaultValue={currentEmployee.id}
                      name="ownerEmployeeId"
                      required
                    >
                      {employees
                        .filter((employee) => employee.status === "active")
                        .map((employee) => (
                          <option key={employee.id} value={employee.id}>
                            {employee.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="grid gap-2 text-[10px] text-muted-foreground md:col-span-2 xl:col-span-4">
                    办理说明（选填）
                    <input
                      className="h-11 rounded-xl border border-border px-3 text-xs text-foreground"
                      maxLength={1000}
                      name="note"
                      placeholder="例如：销售部新员工，需在到岗前完成账号开通"
                    />
                  </label>
                  <button
                    className="h-11 self-end rounded-xl bg-primary px-5 text-xs font-medium text-white hover:bg-[#0c5247]"
                    type="submit"
                  >
                    生成标准清单
                  </button>
                </form>
              </details>
            )}

            <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">办理清单</h2>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  共 {visibleCases.length} 个流程，完成全部事项后流程自动完结
                </p>
              </div>
              <div className="flex rounded-xl bg-[#edf3f0] p-1 text-[10px]">
                {[
                  ["all", "全部"],
                  ["onboarding", "入职"],
                  ["offboarding", "离职"],
                ].map(([value, label]) => (
                  <Link
                    className={`rounded-lg px-3 py-2 ${
                      filter === value
                        ? "bg-white font-medium text-primary shadow-sm"
                        : "text-muted-foreground"
                    }`}
                    href={
                      value === "all"
                        ? "/hr/onboarding"
                        : `/hr/onboarding?type=${value}`
                    }
                    key={value}
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </div>

            <section className="mt-4 space-y-4">
              {visibleCases.length === 0 ? (
                <div className="rounded-[20px] border border-dashed border-border bg-white p-12 text-center">
                  <CircleDashed className="mx-auto size-8 text-muted-foreground/50" />
                  <h3 className="mt-3 text-sm font-semibold">暂无办理流程</h3>
                  <p className="mt-2 text-[10px] text-muted-foreground">
                    人事或管理员可在上方创建第一份标准清单。
                  </p>
                </div>
              ) : (
                visibleCases.map((item) => {
                  const employee = one(item.employee);
                  const owner = one(item.owner);
                  const progress = lifecycleProgress(item.tasks ?? []);
                  const ProcessIcon =
                    item.process_type === "onboarding"
                      ? UserRoundCheck
                      : UserRoundX;
                  return (
                    <article
                      className="overflow-hidden rounded-[20px] border border-border/75 bg-white"
                      key={item.id}
                    >
                      <header className="grid gap-4 border-b border-border/70 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
                        <div className="flex min-w-0 items-center gap-4">
                          <span
                            className={`grid size-11 shrink-0 place-items-center rounded-xl ${
                              item.process_type === "onboarding"
                                ? "bg-[#e9f5ef] text-primary"
                                : "bg-[#fff2ec] text-[#9d5b40]"
                            }`}
                          >
                            <ProcessIcon className="size-5" />
                          </span>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-sm font-semibold">
                                {employee?.name ?? "未知员工"} ·{" "}
                                {item.process_type === "onboarding"
                                  ? "入职办理"
                                  : "离职办理"}
                              </h3>
                              <span
                                className={`rounded-full px-2 py-1 text-[9px] ${
                                  item.status === "completed"
                                    ? "bg-[#e8f6ef] text-primary"
                                    : item.status === "cancelled"
                                      ? "bg-[#f3f3f3] text-muted-foreground"
                                      : "bg-[#fff4db] text-[#8a6216]"
                                }`}
                              >
                                {item.status === "completed"
                                  ? "已完成"
                                  : item.status === "cancelled"
                                    ? "已取消"
                                    : "进行中"}
                              </span>
                            </div>
                            <p className="mt-1 text-[10px] text-muted-foreground">
                              {item.case_no} · {employee?.employee_no} ·
                              生效日期 {item.effective_on} · 负责人{" "}
                              {owner?.name ?? "未分配"}
                            </p>
                          </div>
                        </div>
                        <div className="w-full min-w-[210px] lg:w-[260px]">
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-muted-foreground">清单进度</span>
                            <strong>
                              {progress.completed}/{progress.total} ·{" "}
                              {progress.percent}%
                            </strong>
                          </div>
                          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#eaf0f4]">
                            <div
                              className="h-full rounded-full bg-[#4f9a82] transition-all"
                              style={{ width: `${progress.percent}%` }}
                            />
                          </div>
                        </div>
                      </header>

                      {item.note && (
                        <div className="border-b border-border/60 bg-[#fafcfe] px-5 py-3 text-[10px] text-muted-foreground">
                          说明：{item.note}
                        </div>
                      )}

                      <div className="divide-y divide-border/60">
                        {(item.tasks ?? [])
                          .slice()
                          .sort((a, b) => a.sort_order - b.sort_order)
                          .map((task) => {
                            const responsible = one(task.responsible);
                            const overdue = isLifecycleTaskOverdue(
                              task.due_on,
                              task.status,
                              today(),
                            );
                            return (
                              <div
                                className="grid gap-3 px-5 py-3.5 lg:grid-cols-[minmax(220px,1fr)_120px_150px_auto] lg:items-center"
                                key={task.id}
                              >
                                <div className="flex items-center gap-3">
                                  <span
                                    className={`grid size-7 shrink-0 place-items-center rounded-full ${
                                      task.status === "completed"
                                        ? "bg-[#e8f6ef] text-primary"
                                        : task.status === "not_applicable"
                                          ? "bg-[#f1f2f2] text-muted-foreground"
                                          : overdue
                                            ? "bg-[#fff0f0] text-[#a84d4d]"
                                            : "bg-[#f2f6f4] text-muted-foreground"
                                    }`}
                                  >
                                    {task.status === "completed" ? (
                                      <Check className="size-3.5" />
                                    ) : task.status === "not_applicable" ? (
                                      <X className="size-3.5" />
                                    ) : (
                                      <CircleDashed className="size-3.5" />
                                    )}
                                  </span>
                                  <div>
                                    <div className="text-xs font-medium">
                                      {task.title}
                                    </div>
                                    {task.note && (
                                      <div className="mt-1 text-[9px] text-muted-foreground">
                                        {task.note}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <span className="w-fit rounded-lg bg-[#f2f6f4] px-2 py-1 text-[9px] text-muted-foreground">
                                  {categoryLabels[task.category] ??
                                    task.category}
                                </span>
                                <div className="text-[10px] text-muted-foreground">
                                  <div>{responsible?.name ?? "未分配"}</div>
                                  <div
                                    className={`mt-1 flex items-center gap-1 ${
                                      overdue ? "text-[#a84d4d]" : ""
                                    }`}
                                  >
                                    <CalendarDays className="size-3" />
                                    {task.due_on ?? "未设置"}
                                    {overdue ? " · 已逾期" : ""}
                                  </div>
                                </div>
                                {canManage &&
                                  item.status !== "cancelled" && (
                                    <form
                                      action={
                                        updateEmployeeLifecycleTaskAction
                                      }
                                      className="flex flex-wrap justify-start gap-2 lg:justify-end"
                                    >
                                      <input
                                        name="taskId"
                                        type="hidden"
                                        value={task.id}
                                      />
                                      {task.status === "pending" ? (
                                        <>
                                          <button
                                            className="rounded-lg bg-primary px-3 py-2 text-[9px] font-medium text-white"
                                            name="action"
                                            type="submit"
                                            value="complete"
                                          >
                                            完成
                                          </button>
                                          <button
                                            className="rounded-lg border border-border px-3 py-2 text-[9px]"
                                            name="action"
                                            type="submit"
                                            value="skip"
                                          >
                                            不适用
                                          </button>
                                        </>
                                      ) : (
                                        <button
                                          className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-[9px]"
                                          name="action"
                                          type="submit"
                                          value="reopen"
                                        >
                                          <RotateCcw className="size-3" />
                                          重新打开
                                        </button>
                                      )}
                                    </form>
                                  )}
                              </div>
                            );
                          })}
                      </div>

                      {canManage && item.status === "in_progress" && (
                        <details className="border-t border-border/60 bg-[#fafcfe] px-5 py-3">
                          <summary className="cursor-pointer list-none text-right text-[9px] text-muted-foreground hover:text-[#965151]">
                            取消此流程
                          </summary>
                          <form
                            action={cancelEmployeeLifecycleCaseAction}
                            className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end"
                          >
                            <input
                              name="caseId"
                              type="hidden"
                              value={item.id}
                            />
                            <input
                              className="h-9 min-w-[280px] rounded-lg border border-border bg-white px-3 text-[10px]"
                              maxLength={500}
                              name="reason"
                              placeholder="填写取消原因"
                              required
                            />
                            <button
                              className="h-9 rounded-lg border border-[#dfc7c7] px-3 text-[10px] text-[#8a4b4b]"
                              type="submit"
                            >
                              确认取消
                            </button>
                          </form>
                        </details>
                      )}
                    </article>
                  );
                })
              )}
            </section>

            <div className="mt-5 rounded-[18px] border border-[#dce8e3] bg-[#f5f8fb] px-5 py-4 text-[10px] leading-5 text-muted-foreground">
              安全说明：完成离职清单不会自动停用员工账号或修改员工状态，避免误操作造成访问中断。人事确认交接完成后，仍需进入员工档案执行“已离职”和账号停用操作。
            </div>
          </>
        )}
      </main>
    </WorkflowShell>
  );
}
