import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BriefcaseBusiness,
  CalendarDays,
  FileText,
  History,
  LockKeyhole,
  MapPin,
  Palmtree,
  UserRoundCheck,
} from "lucide-react";
import { EmployeeAvatar } from "@/components/business/employee-avatar";
import { WorkflowShell } from "@/features/approvals/workflow-shell";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import {
  createEmployeeContractAction,
  recordEmployeeChangeAction,
  saveEmployeeHrProfileAction,
  saveEmployeeLeaveBalanceAction,
} from "@/features/employees/server-actions";
import { remainingLeave } from "@/features/employees/hrm";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "员工人事档案",
  description: "德馨星云员工合同、假期账户和任职异动档案",
};

export const dynamic = "force-dynamic";

type Department = { id: string; name: string };

type EmployeeRecord = {
  id: string;
  employee_no: string;
  name: string;
  english_name: string | null;
  email: string | null;
  title: string | null;
  hired_on: string | null;
  employment_status:
    | "active"
    | "departed"
    | "probation"
    | "intern"
    | "part_time";
  avatar_path: string | null;
  department_id: string | null;
  manager_id: string | null;
  department: Department | Department[] | null;
  manager: { id: string; name: string } | Array<{ id: string; name: string }> | null;
};

type HrProfile = {
  work_location: string | null;
  probation_end_on: string | null;
  regularized_on: string | null;
  departure_on: string | null;
  personnel_note: string | null;
};

type EmployeeContract = {
  id: string;
  contract_no: string;
  contract_type:
    | "fixed_term"
    | "indefinite"
    | "intern"
    | "part_time"
    | "confidentiality"
    | "other";
  starts_on: string;
  ends_on: string | null;
  probation_end_on: string | null;
  status: "draft" | "active" | "expired" | "terminated";
  note: string | null;
};

type LeaveBalance = {
  id: string;
  balance_year: number;
  annual_entitled: number;
  annual_used: number;
  compensatory_entitled: number;
  compensatory_used: number;
  sick_used: number;
};

type EmployeeChange = {
  id: string;
  change_type:
    | "hire"
    | "transfer"
    | "promotion"
    | "regularization"
    | "departure"
    | "rehire"
    | "other";
  effective_on: string;
  from_title: string | null;
  to_title: string | null;
  from_employment_status: string | null;
  to_employment_status: string | null;
  reason: string;
  from_department: Department | Department[] | null;
  to_department: Department | Department[] | null;
};

const statusLabels: Record<EmployeeRecord["employment_status"], string> = {
  active: "在职",
  departed: "已离职",
  probation: "试用",
  intern: "实习",
  part_time: "兼职",
};

const contractTypeLabels: Record<EmployeeContract["contract_type"], string> = {
  fixed_term: "固定期限劳动合同",
  indefinite: "无固定期限劳动合同",
  intern: "实习协议",
  part_time: "兼职协议",
  confidentiality: "保密协议",
  other: "其他协议",
};

const contractStatusLabels: Record<EmployeeContract["status"], string> = {
  draft: "草稿",
  active: "履行中",
  expired: "已到期",
  terminated: "已终止",
};

const changeTypeLabels: Record<EmployeeChange["change_type"], string> = {
  hire: "入职",
  transfer: "调动",
  promotion: "晋升",
  regularization: "转正",
  departure: "离职",
  rehire: "返聘",
  other: "其他异动",
};

function relationOne<T>(value: T | T[] | null) {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function today() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function currentYear() {
  return Number(today().slice(0, 4));
}

function feedbackMessage(feedback: Record<string, string | undefined>) {
  if (feedback.profileSaved) return "人事补充档案已保存。";
  if (feedback.contractCreated) {
    return `员工合同 ${feedback.contractCreated} 已登记。`;
  }
  if (feedback.leaveSaved) return "年度假期账户已更新。";
  if (feedback.changeCreated) return "员工异动已登记，当前任职信息已同步更新。";

  const errors: Record<string, string> = {
    forbidden: "当前账号没有维护人事档案的权限。",
    invalid_hr_profile: "人事档案日期或内容不正确。",
    invalid_contract: "合同编号、类型或起止日期不正确。",
    duplicate_contract: "该合同编号已经存在。",
    invalid_leave_balance: "假期额度不正确，已使用天数不能超过总额度。",
    invalid_employee_change: "员工异动信息不完整或状态不正确。",
    operation_failed: "操作未完成，请刷新后重试。",
  };
  return feedback.error
    ? errors[feedback.error] ?? errors.operation_failed
    : "";
}

export default async function EmployeeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [{ id }, feedback] = await Promise.all([params, searchParams]);
  const currentEmployee = await requireCurrentEmployee();
  const canManage = currentEmployee.roleCodes.some((role) =>
    ["hr"].includes(role),
  );
  const canView =
    canManage || currentEmployee.roleCodes.includes("chairman");

  if (!canView) {
    return (
      <WorkflowShell
        activeItem="人力资源"
        breadcrumb="人力资源 / 员工档案 / 人事详情"
        currentUser={{
          name: currentEmployee.name,
          roleLabel: currentEmployee.title ?? "内部员工",
        }}
      >
        <main className="mx-auto max-w-[1200px] p-6">
          <section className="rounded-md border border-border bg-white p-12 text-center">
            <LockKeyhole className="mx-auto size-9 text-foreground" />
            <h1 className="mt-4 text-lg font-semibold">无权查看人事档案</h1>
            <p className="mt-2 text-xs text-muted-foreground">
              员工人事档案仅向人事、管理员和董事长只读开放。
            </p>
          </section>
        </main>
      </WorkflowShell>
    );
  }

  const supabase = await createClient();
  const [
    employeeResult,
    profileResult,
    contractResult,
    leaveResult,
    changeResult,
    departmentResult,
  ] = await Promise.all([
    supabase
      .from("employees")
      .select(
        "id, employee_no, name, english_name, email, title, hired_on, employment_status, avatar_path, department_id, manager_id, department:departments!employees_department_id_fkey(id, name), manager:employees!employees_manager_id_fkey(id, name)",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("employee_hr_profiles")
      .select(
        "work_location, probation_end_on, regularized_on, departure_on, personnel_note",
      )
      .eq("employee_id", id)
      .maybeSingle(),
    supabase
      .from("employee_contracts")
      .select(
        "id, contract_no, contract_type, starts_on, ends_on, probation_end_on, status, note",
      )
      .eq("employee_id", id)
      .order("starts_on", { ascending: false }),
    supabase
      .from("employee_leave_balances")
      .select(
        "id, balance_year, annual_entitled, annual_used, compensatory_entitled, compensatory_used, sick_used",
      )
      .eq("employee_id", id)
      .order("balance_year", { ascending: false }),
    supabase
      .from("employee_changes")
      .select(
        "id, change_type, effective_on, from_title, to_title, from_employment_status, to_employment_status, reason, from_department:departments!employee_changes_from_department_id_fkey(id, name), to_department:departments!employee_changes_to_department_id_fkey(id, name)",
      )
      .eq("employee_id", id)
      .order("effective_on", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("departments")
      .select("id, name")
      .eq("status", "active")
      .order("name"),
  ]);

  if (!employeeResult.data) notFound();

  const employee = employeeResult.data as EmployeeRecord;
  const profile = (profileResult.data ?? null) as HrProfile | null;
  const contracts = (contractResult.data ?? []) as EmployeeContract[];
  const leaveBalances = (leaveResult.data ?? []) as LeaveBalance[];
  const changes = (changeResult.data ?? []) as EmployeeChange[];
  const departments = (departmentResult.data ?? []) as Department[];
  const department = relationOne(employee.department);
  const manager = relationOne(employee.manager);
  const currentBalance =
    leaveBalances.find((item) => item.balance_year === currentYear()) ?? null;
  const annualRemaining = currentBalance
    ? remainingLeave(
        Number(currentBalance.annual_entitled),
        Number(currentBalance.annual_used),
      )
    : null;
  const compensatoryRemaining = currentBalance
    ? remainingLeave(
        Number(currentBalance.compensatory_entitled),
        Number(currentBalance.compensatory_used),
      )
    : null;
  const activeContract =
    contracts.find((contract) => contract.status === "active") ?? null;
  const { data: signedAvatar } = employee.avatar_path
    ? await supabase.storage
        .from("avatars")
        .createSignedUrl(employee.avatar_path, 3600)
    : { data: null };
  const message = feedbackMessage(feedback);

  return (
    <WorkflowShell
      activeItem="人力资源"
      breadcrumb="人力资源 / 员工档案 / 人事详情"
      currentUser={{
        name: currentEmployee.name,
        roleLabel: currentEmployee.title ?? "内部员工",
      }}
    >
      <main className="mx-auto max-w-[1440px] p-4 sm:p-6 xl:p-8">
        <Link
          className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-primary"
          href="/employees"
        >
          <ArrowLeft className="size-4" />
          返回员工中心
        </Link>

        <section className="mt-4 overflow-hidden rounded-md bg-primary px-6 py-7 text-white sm:px-8">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
            <div className="flex items-center gap-4">
              <EmployeeAvatar
                name={employee.name}
                size="lg"
                src={signedAvatar?.signedUrl}
              />
              <div>
                <div className="text-xs tracking-[0.14em] text-muted-foreground">
                  HRM · EMPLOYEE LIFECYCLE
                </div>
                <h1 className="mt-2 text-2xl font-semibold">
                  {employee.name}
                  {employee.english_name ? ` · ${employee.english_name}` : ""}
                </h1>
                <p className="mt-2 text-xs text-white/55">
                  {employee.employee_no} · {department?.name ?? "未分部门"} ·{" "}
                  {employee.title ?? "未设置职位"}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-white/10 px-3 py-2">
                {statusLabels[employee.employment_status]}
              </span>
              <span className="rounded-full bg-white/10 px-3 py-2">
                入职 {employee.hired_on ?? "待补充"}
              </span>
            </div>
          </div>
        </section>

        {message && (
          <div
            className={`mt-5 rounded-md px-4 py-3 text-xs ${
              feedback.error
                ? "border border-border bg-muted text-foreground"
                : "border border-border bg-muted text-primary"
            }`}
          >
            {message}
          </div>
        )}

        <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            [
              department?.name ?? "待设置",
              "当前部门",
              manager ? `直属负责人：${manager.name}` : "直属负责人待设置",
              BriefcaseBusiness,
            ],
            [
              profile?.work_location ?? "待设置",
              "办公地点",
              profile?.regularized_on
                ? `已于 ${profile.regularized_on} 转正`
                : "转正日期待维护",
              MapPin,
            ],
            [
              activeContract?.ends_on ?? "长期/待登记",
              "合同到期",
              activeContract
                ? contractTypeLabels[activeContract.contract_type]
                : "暂无履行中合同",
              FileText,
            ],
            [
              annualRemaining === null ? "待配置" : `${annualRemaining} 天`,
              `${currentYear()} 年假余额`,
              compensatoryRemaining === null
                ? "调休余额待配置"
                : `调休剩余 ${compensatoryRemaining} 天`,
              Palmtree,
            ],
          ].map(([value, label, note, Icon]) => {
            const CardIcon = Icon as typeof BriefcaseBusiness;
            return (
              <article
                className="rounded-md border border-border/75 bg-white p-5"
                key={String(label)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs text-muted-foreground">
                      {String(label)}
                    </div>
                    <div className="mt-2 text-lg font-semibold">
                      {String(value)}
                    </div>
                  </div>
                  <CardIcon className="size-5 text-primary/60" />
                </div>
                <div className="mt-3 text-xs text-muted-foreground">
                  {String(note)}
                </div>
              </article>
            );
          })}
        </section>

        <div className="mt-5 grid items-start gap-5 xl:grid-cols-[1.05fr_.95fr]">
          <div className="space-y-5">
            <section className="rounded-md border border-border/75 bg-white p-5 sm:p-6">
              <div className="flex items-center gap-2">
                <UserRoundCheck className="size-5 text-primary" />
                <h2 className="text-base font-semibold">人事补充档案</h2>
              </div>
              <dl className="mt-5 grid gap-3 text-xs sm:grid-cols-2">
                {[
                  ["企业邮箱", employee.email ?? "待补充"],
                  ["办公地点", profile?.work_location ?? "待补充"],
                  ["试用期结束", profile?.probation_end_on ?? "待补充"],
                  ["实际转正", profile?.regularized_on ?? "待补充"],
                  ["离职日期", profile?.departure_on ?? "不适用"],
                  ["直属负责人", manager?.name ?? "待设置"],
                ].map(([label, value]) => (
                  <div className="rounded-md bg-muted p-3" key={label}>
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="mt-1 font-medium">{value}</dd>
                  </div>
                ))}
              </dl>
              {canManage && (
                <details className="mt-4 rounded-md border border-border p-3">
                  <summary className="cursor-pointer text-xs font-medium text-primary">
                    编辑人事补充档案
                  </summary>
                  <form
                    action={saveEmployeeHrProfileAction}
                    className="mt-4 grid gap-3 sm:grid-cols-2"
                  >
                    <input name="employeeId" type="hidden" value={employee.id} />
                    <input className="h-10 rounded-md border border-border px-3 text-xs" defaultValue={profile?.work_location ?? ""} name="workLocation" placeholder="办公地点" />
                    <input className="h-10 rounded-md border border-border px-3 text-xs" defaultValue={profile?.probation_end_on ?? ""} name="probationEndOn" type="date" />
                    <input className="h-10 rounded-md border border-border px-3 text-xs" defaultValue={profile?.regularized_on ?? ""} name="regularizedOn" type="date" />
                    <input className="h-10 rounded-md border border-border px-3 text-xs" defaultValue={profile?.departure_on ?? ""} name="departureOn" type="date" />
                    <textarea className="min-h-20 rounded-md border border-border px-3 py-2 text-xs sm:col-span-2" defaultValue={profile?.personnel_note ?? ""} name="personnelNote" placeholder="仅人事与管理层可见的内部备注" />
                    <button className="h-10 rounded-md bg-primary text-xs text-primary-foreground sm:col-span-2" type="submit">
                      保存人事档案
                    </button>
                  </form>
                </details>
              )}
            </section>

            <section className="rounded-md border border-border/75 bg-white p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold">合同台账</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    合同原件请上传至私有文件中心
                  </p>
                </div>
                <Link className="text-xs text-primary" href="/documents?category=contract">
                  文件中心
                </Link>
              </div>
              <div className="mt-4 space-y-2">
                {contracts.map((contract) => (
                  <article className="rounded-md bg-muted p-3" key={contract.id}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-xs font-medium">
                          {contractTypeLabels[contract.contract_type]}
                        </div>
                        <div className="mt-1 font-mono text-xs text-muted-foreground">
                          {contract.contract_no}
                        </div>
                      </div>
                      <span className="rounded-full bg-white px-2 py-1 text-xs text-primary">
                        {contractStatusLabels[contract.status]}
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {contract.starts_on} — {contract.ends_on ?? "无固定期限"}
                    </div>
                  </article>
                ))}
                {!contracts.length && (
                  <div className="rounded-md bg-muted p-5 text-center text-xs text-muted-foreground">
                    暂无合同记录
                  </div>
                )}
              </div>
              {canManage && (
                <details className="mt-4 rounded-md border border-border p-3">
                  <summary className="cursor-pointer text-xs font-medium text-primary">
                    登记员工合同
                  </summary>
                  <form action={createEmployeeContractAction} className="mt-4 grid gap-3 sm:grid-cols-2">
                    <input name="employeeId" type="hidden" value={employee.id} />
                    <input className="h-10 rounded-md border border-border px-3 text-xs" name="contractNo" placeholder="合同编号" required />
                    <select className="h-10 rounded-md border border-border px-3 text-xs" name="contractType">
                      <option value="fixed_term">固定期限劳动合同</option>
                      <option value="indefinite">无固定期限劳动合同</option>
                      <option value="intern">实习协议</option>
                      <option value="part_time">兼职协议</option>
                      <option value="confidentiality">保密协议</option>
                      <option value="other">其他协议</option>
                    </select>
                    <input className="h-10 rounded-md border border-border px-3 text-xs" defaultValue={employee.hired_on ?? today()} name="startsOn" required type="date" />
                    <input className="h-10 rounded-md border border-border px-3 text-xs" name="endsOn" type="date" />
                    <input className="h-10 rounded-md border border-border px-3 text-xs" defaultValue={profile?.probation_end_on ?? ""} name="probationEndOn" type="date" />
                    <select className="h-10 rounded-md border border-border px-3 text-xs" name="status">
                      <option value="active">履行中</option>
                      <option value="draft">草稿</option>
                      <option value="expired">已到期</option>
                      <option value="terminated">已终止</option>
                    </select>
                    <textarea className="min-h-16 rounded-md border border-border px-3 py-2 text-xs sm:col-span-2" name="note" placeholder="合同备注（选填）" />
                    <button className="h-10 rounded-md bg-primary text-xs text-primary-foreground sm:col-span-2" type="submit">
                      保存合同记录
                    </button>
                  </form>
                </details>
              )}
            </section>
          </div>

          <div className="space-y-5">
            <section className="rounded-md border border-border/75 bg-white p-5 sm:p-6">
              <div className="flex items-center gap-2">
                <CalendarDays className="size-5 text-primary" />
                <h2 className="text-base font-semibold">假期账户</h2>
              </div>
              {currentBalance ? (
                <div className="mt-4 grid grid-cols-3 gap-3">
                  {[
                    ["年假剩余", `${annualRemaining} 天`],
                    ["调休剩余", `${compensatoryRemaining} 天`],
                    ["病假已用", `${currentBalance.sick_used} 天`],
                  ].map(([label, value]) => (
                    <div className="rounded-md bg-muted p-3 text-center" key={label}>
                      <div className="text-sm font-semibold">{value}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 rounded-md bg-muted p-4 text-xs text-foreground">
                  {currentYear()} 年假期账户尚未配置。
                </div>
              )}
              {canManage && (
                <details className="mt-4 rounded-md border border-border p-3">
                  <summary className="cursor-pointer text-xs font-medium text-primary">
                    设置年度假期额度
                  </summary>
                  <form action={saveEmployeeLeaveBalanceAction} className="mt-4 grid grid-cols-2 gap-3">
                    <input name="employeeId" type="hidden" value={employee.id} />
                    <input className="h-10 rounded-md border border-border px-3 text-xs" defaultValue={currentYear()} max="2100" min="2020" name="balanceYear" required type="number" />
                    <div />
                    <input className="h-10 rounded-md border border-border px-3 text-xs" defaultValue={currentBalance?.annual_entitled ?? 0} min="0" name="annualEntitled" placeholder="年假额度" required step="0.5" type="number" />
                    <input className="h-10 rounded-md border border-border px-3 text-xs" defaultValue={currentBalance?.annual_used ?? 0} min="0" name="annualUsed" placeholder="年假已用" required step="0.5" type="number" />
                    <input className="h-10 rounded-md border border-border px-3 text-xs" defaultValue={currentBalance?.compensatory_entitled ?? 0} min="0" name="compensatoryEntitled" placeholder="调休额度" required step="0.5" type="number" />
                    <input className="h-10 rounded-md border border-border px-3 text-xs" defaultValue={currentBalance?.compensatory_used ?? 0} min="0" name="compensatoryUsed" placeholder="调休已用" required step="0.5" type="number" />
                    <input className="h-10 rounded-md border border-border px-3 text-xs" defaultValue={currentBalance?.sick_used ?? 0} min="0" name="sickUsed" placeholder="病假已用" required step="0.5" type="number" />
                    <button className="h-10 rounded-md bg-primary text-xs text-primary-foreground" type="submit">
                      保存假期账户
                    </button>
                  </form>
                </details>
              )}
            </section>

            <section className="rounded-md border border-border/75 bg-white p-5 sm:p-6">
              <div className="flex items-center gap-2">
                <History className="size-5 text-primary" />
                <h2 className="text-base font-semibold">员工异动历史</h2>
              </div>
              <div className="mt-4 space-y-3">
                {changes.map((change) => (
                  <article className="relative border-l border-border pl-4" key={change.id}>
                    <span className="absolute -left-1 top-1 size-2 rounded-full bg-primary" />
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-medium">
                        {changeTypeLabels[change.change_type]}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {change.effective_on}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {relationOne(change.from_department)?.name ?? "未分部门"} →{" "}
                      {relationOne(change.to_department)?.name ?? "未分部门"}
                      {change.to_title ? ` · ${change.to_title}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {change.reason}
                    </p>
                  </article>
                ))}
                {!changes.length && (
                  <div className="rounded-md bg-muted p-5 text-center text-xs text-muted-foreground">
                    暂无异动记录
                  </div>
                )}
              </div>
              {canManage && (
                <details className="mt-4 rounded-md border border-border p-3">
                  <summary className="cursor-pointer text-xs font-medium text-primary">
                    登记员工异动
                  </summary>
                  <form action={recordEmployeeChangeAction} className="mt-4 grid gap-3 sm:grid-cols-2">
                    <input name="employeeId" type="hidden" value={employee.id} />
                    <select className="h-10 rounded-md border border-border px-3 text-xs" name="changeType">
                      <option value="transfer">部门调动</option>
                      <option value="promotion">晋升</option>
                      <option value="regularization">转正</option>
                      <option value="departure">离职</option>
                      <option value="rehire">返聘</option>
                      <option value="hire">入职</option>
                      <option value="other">其他异动</option>
                    </select>
                    <input className="h-10 rounded-md border border-border px-3 text-xs" defaultValue={today()} name="effectiveOn" required type="date" />
                    <select className="h-10 rounded-md border border-border px-3 text-xs" defaultValue={employee.department_id ?? ""} name="toDepartmentId">
                      <option value="">不分配部门</option>
                      {departments.map((item) => (
                        <option key={item.id} value={item.id}>{item.name}</option>
                      ))}
                    </select>
                    <input className="h-10 rounded-md border border-border px-3 text-xs" defaultValue={employee.title ?? ""} name="toTitle" placeholder="变更后职位" />
                    <select className="h-10 rounded-md border border-border px-3 text-xs" defaultValue={employee.employment_status} name="toEmploymentStatus">
                      <option value="active">在职</option>
                      <option value="probation">试用</option>
                      <option value="intern">实习</option>
                      <option value="part_time">兼职</option>
                      <option value="departed">已离职</option>
                    </select>
                    <input className="h-10 rounded-md border border-border px-3 text-xs" name="reason" placeholder="异动原因" required />
                    <button className="h-10 rounded-md bg-primary text-xs text-primary-foreground sm:col-span-2" type="submit">
                      确认异动并更新任职信息
                    </button>
                  </form>
                </details>
              )}
            </section>
          </div>
        </div>
      </main>
    </WorkflowShell>
  );
}
