import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarCheck2,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clock3,
  FilePlus2,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { WorkflowShell } from "@/features/approvals/workflow-shell";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import {
  dateRangeOverlapDays,
  isOnApprovedLeave,
  leaveBalanceSyncLabel,
} from "@/features/hr/attendance";
import { remainingLeave } from "@/features/employees/hrm";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "考勤与假期管理",
  description: "德馨星云请假考勤、假期余额和出勤接口状态",
};

export const dynamic = "force-dynamic";

type EmployeeRelation = {
  id: string;
  name: string;
  employee_no: string;
  title: string | null;
};
type LeaveRow = {
  id: string;
  applicant_employee_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  leave_days: number;
  status: string;
  reason: string;
  created_at: string;
  applicant: EmployeeRelation | EmployeeRelation[] | null;
};
type BalanceRow = {
  employee_id: string;
  balance_year: number;
  annual_entitled: number;
  annual_used: number;
  compensatory_entitled: number;
  compensatory_used: number;
  sick_used: number;
  employee: EmployeeRelation | EmployeeRelation[] | null;
};
type UsageRow = {
  id: string;
  leave_request_id: string;
  employee_id: string;
  balance_year: number;
  leave_type: string;
  leave_days: number;
  sync_status: string;
};

const leaveTypeLabels: Record<string, string> = {
  welfare: "福利假",
  sick: "病假",
  personal: "事假",
  marriage: "婚假",
  bereavement: "丧假",
  maternity: "产假",
  paternity: "陪产假",
  work_injury: "工伤假",
  other: "其他法定假期",
};

const statusLabels: Record<string, string> = {
  pending_department: "直属负责人审批",
  pending_chairman: "董事长审批",
  pending_hr_filing: "HR 备案",
  approved: "已通过",
  returned: "已退回",
  rejected: "已驳回",
  withdrawn: "已撤回",
};

function one<T>(value: T | T[] | null) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function shanghaiDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function monthRange(date: string) {
  const [year, month] = date.split("-").map(Number);
  const end = new Date(Date.UTC(year, month, 0))
    .toISOString()
    .slice(0, 10);
  return {
    start: `${date.slice(0, 7)}-01`,
    end,
  };
}

export default async function AttendancePage() {
  const currentEmployee = await requireCurrentEmployee();
  const supabase = await createClient();
  const currentDate = shanghaiDate();
  const currentYear = Number(currentDate.slice(0, 4));
  const month = monthRange(currentDate);
  const canViewTeam = currentEmployee.roleCodes.some((role) =>
    ["hr", "chairman", "department_lead"].includes(role),
  );

  const [leaveResult, balanceResult, usageResult] = await Promise.all([
    supabase
      .from("leave_requests")
      .select(
        "id, applicant_employee_id, leave_type, start_date, end_date, leave_days, status, reason, created_at, applicant:employees!leave_requests_applicant_employee_id_fkey(id, name, employee_no, title)",
      )
      .gte("end_date", `${currentYear}-01-01`)
      .lte("start_date", `${currentYear}-12-31`)
      .order("created_at", { ascending: false }),
    supabase
      .from("employee_leave_balances")
      .select(
        "employee_id, balance_year, annual_entitled, annual_used, compensatory_entitled, compensatory_used, sick_used, employee:employees!employee_leave_balances_employee_id_fkey(id, name, employee_no, title)",
      )
      .eq("balance_year", currentYear),
    supabase
      .from("employee_leave_usages")
      .select(
        "id, leave_request_id, employee_id, balance_year, leave_type, leave_days, sync_status",
      )
      .eq("balance_year", currentYear),
  ]);

  const leaves = (leaveResult.data ?? []) as unknown as LeaveRow[];
  const balances = (balanceResult.data ?? []) as unknown as BalanceRow[];
  const usages = (usageResult.data ?? []) as UsageRow[];
  const loadError = Boolean(
    leaveResult.error || balanceResult.error || usageResult.error,
  );
  const pendingStatuses = new Set([
    "pending_department",
    "pending_chairman",
    "pending_hr_filing",
  ]);
  const approvedLeaves = leaves.filter((item) => item.status === "approved");
  const monthlyApprovedDays = approvedLeaves.reduce(
    (sum, item) =>
      sum +
      dateRangeOverlapDays(
        item.start_date,
        item.end_date,
        month.start,
        month.end,
      ),
    0,
  );
  const pendingCount = leaves.filter((item) =>
    pendingStatuses.has(item.status),
  ).length;
  const onLeaveToday = approvedLeaves.filter((item) =>
    isOnApprovedLeave(
      item.status,
      item.start_date,
      item.end_date,
      currentDate,
    ),
  );
  const syncIssues = usages.filter((item) =>
    ["balance_missing", "insufficient_balance"].includes(item.sync_status),
  );
  const currentBalance = balances.find(
    (item) => item.employee_id === currentEmployee.id,
  );
  const typeTotals = Object.entries(
    approvedLeaves.reduce<Record<string, number>>((totals, item) => {
      const days = dateRangeOverlapDays(
        item.start_date,
        item.end_date,
        month.start,
        month.end,
      );
      if (days > 0) {
        totals[item.leave_type] = (totals[item.leave_type] ?? 0) + days;
      }
      return totals;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);
  const maxTypeDays = Math.max(...typeTotals.map((item) => item[1]), 1);
  const usageByRequest = new Map(
    usages.map((usage) => [usage.leave_request_id, usage]),
  );

  return (
    <WorkflowShell
      activeItem="人力资源"
      breadcrumb="人力资源 / 考勤管理"
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

        <section className="relative mt-5 overflow-hidden rounded-[24px] bg-[#0a385d] px-6 py-8 text-white sm:px-8">
          <div className="absolute -right-16 -top-20 size-72 rounded-full border border-white/10" />
          <CalendarCheck2 className="absolute right-10 top-1/2 hidden size-36 -translate-y-1/2 text-white/[0.06] md:block" />
          <div className="relative flex max-w-4xl flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <div className="text-[10px] tracking-[0.16em] text-[#79d8d5]">
                HRM · ATTENDANCE & LEAVE
              </div>
              <h1 className="mt-3 text-2xl font-semibold tracking-[-0.03em] sm:text-[30px]">
                考勤与假期管理
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/55">
                汇总请假审批、当月休假、员工假期账户与余额同步状态。企业微信打卡和门禁数据尚未接入，当前不生成虚假出勤率。
              </p>
            </div>
            <Link
              className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-[#6bd7d4] px-4 text-xs font-medium text-[#0b3152]"
              href="/requests/leave"
            >
              <FilePlus2 className="size-4" />
              发起请假
            </Link>
          </div>
        </section>

        {loadError && (
          <div className="mt-4 rounded-xl border border-[#ead3d3] bg-[#fff7f7] px-4 py-3 text-xs text-[#914949]">
            无法读取考勤数据，请确认考勤与假期联动迁移已经执行。
          </div>
        )}

        <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              value: monthlyApprovedDays,
              label: "本月已批休假天数",
              note: `${month.start.slice(5)} 至 ${month.end.slice(5)}`,
              icon: CalendarClock,
            },
            {
              value: pendingCount,
              label: "审批中申请",
              note: "当前权限范围",
              icon: Clock3,
            },
            {
              value: onLeaveToday.length,
              label: "今日休假人数",
              note: currentDate,
              icon: UsersRound,
            },
            {
              value: syncIssues.length,
              label: "余额待处理",
              note: "未配置或余额不足",
              icon: CircleAlert,
            },
          ].map(({ value, label, note, icon: Icon }) => (
            <article
              className="rounded-[18px] border border-border/75 bg-white p-5"
              key={label}
            >
              <div className="flex items-center justify-between">
                <div className="text-2xl font-semibold">{value}</div>
                <span className="grid size-9 place-items-center rounded-xl bg-[#edf4f7] text-primary">
                  <Icon className="size-4" />
                </span>
              </div>
              <div className="mt-2 text-xs font-medium">{label}</div>
              <div className="mt-1 text-[9px] text-muted-foreground">{note}</div>
            </article>
          ))}
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-[.85fr_1.15fr]">
          <article className="rounded-[20px] border border-border/75 bg-white p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-primary" />
              <div>
                <h2 className="text-base font-semibold">
                  我的 {currentYear} 年假期账户
                </h2>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  已通过的福利假和病假将自动尝试同步
                </p>
              </div>
            </div>
            {currentBalance ? (
              <dl className="mt-5 grid grid-cols-2 gap-3">
                {[
                  [
                    remainingLeave(
                      currentBalance.annual_entitled,
                      currentBalance.annual_used,
                    ),
                    "年假剩余",
                    `${currentBalance.annual_used}/${currentBalance.annual_entitled} 天`,
                  ],
                  [
                    remainingLeave(
                      currentBalance.compensatory_entitled,
                      currentBalance.compensatory_used,
                    ),
                    "调休剩余",
                    `${currentBalance.compensatory_used}/${currentBalance.compensatory_entitled} 天`,
                  ],
                  [
                    currentBalance.sick_used,
                    "病假已用",
                    "按已批准记录",
                  ],
                  [
                    usages.filter(
                      (item) =>
                        item.employee_id === currentEmployee.id &&
                        item.sync_status === "not_applicable",
                    ).reduce((sum, item) => sum + Number(item.leave_days), 0),
                    "其他假期",
                    "仅计考勤，不扣年假",
                  ],
                ].map(([value, label, note]) => (
                  <div className="rounded-xl bg-[#f5f8fb] p-4" key={String(label)}>
                    <dt className="text-[9px] text-muted-foreground">{label}</dt>
                    <dd className="mt-1 text-xl font-semibold">{value} 天</dd>
                    <div className="mt-1 text-[9px] text-muted-foreground">
                      {note}
                    </div>
                  </div>
                ))}
              </dl>
            ) : (
              <div className="mt-5 rounded-xl border border-dashed border-border p-8 text-center text-[10px] text-muted-foreground">
                本年度假期账户尚未配置，请联系行政人事。
              </div>
            )}
          </article>

          <article className="rounded-[20px] border border-border/75 bg-white p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">本月休假结构</h2>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  已通过申请，按与本月重叠天数统计
                </p>
              </div>
              <Link
                className="inline-flex items-center gap-1 text-[10px] text-primary"
                href="/approvals"
              >
                审批中心
                <ChevronRight className="size-3" />
              </Link>
            </div>
            {typeTotals.length ? (
              <div className="mt-6 space-y-4">
                {typeTotals.map(([type, days]) => (
                  <div
                    className="grid grid-cols-[72px_1fr_42px] items-center gap-3 text-[10px]"
                    key={type}
                  >
                    <span className="text-muted-foreground">
                      {leaveTypeLabels[type] ?? type}
                    </span>
                    <div className="h-2 overflow-hidden rounded-full bg-[#eaf0f4]">
                      <div
                        className="h-full rounded-full bg-[#4f9a82]"
                        style={{ width: `${(days / maxTypeDays) * 100}%` }}
                      />
                    </div>
                    <strong className="text-right">{days} 天</strong>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded-xl border border-dashed border-border p-8 text-center text-[10px] text-muted-foreground">
                本月暂无已通过的休假记录。
              </div>
            )}
          </article>
        </section>

        {onLeaveToday.length > 0 && (
          <section className="mt-5 rounded-[20px] border border-[#d9e8e1] bg-[#f1f7f4] p-5">
            <div className="flex items-center gap-2">
              <UsersRound className="size-4 text-primary" />
              <h2 className="text-sm font-semibold">今日休假</h2>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {onLeaveToday.map((item) => {
                const applicant = one(item.applicant);
                return (
                  <span
                    className="rounded-xl bg-white px-3 py-2 text-[10px]"
                    key={item.id}
                  >
                    {applicant?.name ?? "未知员工"} ·{" "}
                    {leaveTypeLabels[item.leave_type] ?? item.leave_type}
                  </span>
                );
              })}
            </div>
          </section>
        )}

        <section className="mt-5 overflow-hidden rounded-[20px] border border-border/75 bg-white">
          <div className="border-b border-border/70 px-5 py-4">
            <h2 className="text-base font-semibold">
              {canViewTeam ? "权限范围内请假记录" : "我的请假记录"}
            </h2>
            <p className="mt-1 text-[10px] text-muted-foreground">
              状态与审批中心保持一致，余额同步结果单独展示
            </p>
          </div>
          {leaves.length ? (
            <div className="divide-y divide-border/60">
              {leaves.slice(0, 30).map((item) => {
                const applicant = one(item.applicant);
                const usage = usageByRequest.get(item.id);
                return (
                  <div
                    className="grid gap-3 px-5 py-4 md:grid-cols-[1fr_110px_150px_140px] md:items-center"
                    key={item.id}
                  >
                    <div>
                      <div className="text-xs font-medium">
                        {applicant?.name ?? "未知员工"} ·{" "}
                        {leaveTypeLabels[item.leave_type] ?? item.leave_type}
                      </div>
                      <div className="mt-1 line-clamp-1 text-[9px] text-muted-foreground">
                        {item.reason}
                      </div>
                    </div>
                    <div className="text-[10px]">
                      <div className="font-medium">{item.leave_days} 天</div>
                      <div className="mt-1 text-muted-foreground">
                        {item.start_date} 至 {item.end_date}
                      </div>
                    </div>
                    <span className="w-fit rounded-lg bg-[#f2f6f4] px-2 py-1 text-[9px] text-muted-foreground">
                      {statusLabels[item.status] ?? item.status}
                    </span>
                    {item.status === "approved" && usage ? (
                      <span
                        className={`inline-flex w-fit items-center gap-1 rounded-lg px-2 py-1 text-[9px] ${
                          ["balance_missing", "insufficient_balance"].includes(
                            usage.sync_status,
                          )
                            ? "bg-[#fff3e4] text-[#8b5f1d]"
                            : "bg-[#eaf6f0] text-primary"
                        }`}
                      >
                        {usage.sync_status === "recorded" ? (
                          <CheckCircle2 className="size-3" />
                        ) : (
                          <CircleAlert className="size-3" />
                        )}
                        {leaveBalanceSyncLabel(usage.sync_status)}
                      </span>
                    ) : (
                      <span className="text-[9px] text-muted-foreground">—</span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-12 text-center text-[10px] text-muted-foreground">
              暂无请假记录。
            </div>
          )}
        </section>

        {canViewTeam && (
          <section className="mt-5 overflow-hidden rounded-[20px] border border-border/75 bg-white">
            <div className="border-b border-border/70 px-5 py-4">
              <h2 className="text-base font-semibold">年度假期账户概览</h2>
              <p className="mt-1 text-[10px] text-muted-foreground">
                数据范围由员工关系与 HR 权限控制
              </p>
            </div>
            {balances.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-[10px]">
                  <thead className="bg-[#f3f7fa] text-muted-foreground">
                    <tr>
                      <th className="px-5 py-3 font-medium">员工</th>
                      <th className="px-4 py-3 font-medium">年假额度</th>
                      <th className="px-4 py-3 font-medium">年假已用</th>
                      <th className="px-4 py-3 font-medium">年假剩余</th>
                      <th className="px-4 py-3 font-medium">调休剩余</th>
                      <th className="px-4 py-3 font-medium">病假已用</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {balances.map((balance) => {
                      const employee = one(balance.employee);
                      return (
                        <tr key={balance.employee_id}>
                          <td className="px-5 py-3.5 font-medium">
                            {employee?.name ?? "未知员工"}
                          </td>
                          <td className="px-4 py-3.5">
                            {balance.annual_entitled} 天
                          </td>
                          <td className="px-4 py-3.5">
                            {balance.annual_used} 天
                          </td>
                          <td className="px-4 py-3.5 text-primary">
                            {remainingLeave(
                              balance.annual_entitled,
                              balance.annual_used,
                            )}{" "}
                            天
                          </td>
                          <td className="px-4 py-3.5">
                            {remainingLeave(
                              balance.compensatory_entitled,
                              balance.compensatory_used,
                            )}{" "}
                            天
                          </td>
                          <td className="px-4 py-3.5">
                            {balance.sick_used} 天
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-10 text-center text-[10px] text-muted-foreground">
                当前权限范围内暂无已配置的假期账户。
              </div>
            )}
          </section>
        )}

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-[18px] border border-[#dce8e3] bg-[#f5f8fb] px-5 py-4 text-[10px] leading-5 text-muted-foreground">
            <strong className="text-foreground">同步规则：</strong>
            福利假计入年假已用，病假计入病假已用；事假、婚假、丧假、产假等仅记录考勤，不扣减年假。余额未配置或不足时保留申请结果并提示人事处理。
          </div>
          <div className="rounded-[18px] border border-border bg-white px-5 py-4 text-[10px] leading-5 text-muted-foreground">
            <strong className="text-foreground">外部考勤：</strong>
            企业微信、门禁和 GPS 外勤尚未接入，因此“迟到、早退、打卡率”等指标暂不展示。后续确认实际考勤数据源后再建设接口。
          </div>
        </div>
      </main>
    </WorkflowShell>
  );
}
