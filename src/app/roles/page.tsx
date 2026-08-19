import type { Metadata } from "next";
import {
  EyeOff,
  History,
  KeyRound,
  LockKeyhole,
  Clock3,
  ShieldCheck,
  ShieldAlert,
  UserRoundCheck,
} from "lucide-react";
import { WorkflowShell } from "@/features/approvals/workflow-shell";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import { saveEmployeeRolesAction } from "@/features/employees/server-actions";
import {
  operationPermissionRows,
  pagePermissionRows,
  permissionLegend,
  roles,
  sensitiveFieldRows,
  type PermissionCell,
  type PermissionLevel,
} from "@/features/permissions/role-permission-matrix";
import {
  grantTemporaryRoleAction,
  revokeTemporaryRoleAction,
} from "@/features/permissions/server-actions";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "角色与权限",
  description: "德馨星云角色、操作权限、数据范围与敏感字段权限矩阵",
};

export const dynamic = "force-dynamic";

const permissionTone: Record<PermissionLevel, string> = {
  full: "border-[#b9dbce] bg-[#eaf3f8] text-[#0d6c78]",
  department: "border-[#cbd9e3] bg-[#edf2f7] text-[#42647a]",
  self: "border-[#d8d1e4] bg-[#f3eef8] text-[#77518e]",
  limited: "border-[#f0dec5] bg-[#fff4e7] text-[#9a6321]",
  configure: "border-[#c8d9d4] bg-[#eef4f8] text-[#285f53]",
  none: "border-[#ead8d8] bg-[#f8eeee] text-[#965151]",
};

type TemplateVersion = {
  id: string;
  template_key: string;
  version: number;
  change_note: string;
  created_at: string;
  creator: { name: string } | Array<{ name: string }> | null;
};

type EmployeeIdentity = {
  id: string;
  name: string;
  employee_no: string;
};

type EmployeeOption = EmployeeIdentity & {
  title: string | null;
  employee_roles: Array<{
    role:
      | { code: string; name: string }
      | Array<{ code: string; name: string }>
      | null;
  }>;
};

type TemporaryGrant = {
  id: string;
  expires_at: string;
  reason: string;
  created_at: string;
  employee: EmployeeIdentity | EmployeeIdentity[] | null;
  role:
    | { code: string; name: string }
    | Array<{ code: string; name: string }>
    | null;
  granter: { name: string } | Array<{ name: string }> | null;
};

function relationOne<T>(value: T | T[] | null) {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function formatDateTime(value: string) {
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

function creatorName(version: TemplateVersion) {
  const creator = Array.isArray(version.creator)
    ? version.creator[0]
    : version.creator;
  return creator?.name ?? "系统迁移";
}

function employeeRoleCodes(employee: EmployeeOption) {
  return employee.employee_roles
    .map((assignment) => relationOne(assignment.role)?.code)
    .filter((code): code is string => Boolean(code));
}

function PermissionPill({ permission }: { permission: PermissionCell }) {
  return (
    <span
      className={`inline-flex min-h-7 items-center whitespace-nowrap rounded-lg border px-2.5 py-1 text-[10px] font-medium ${permissionTone[permission.level]}`}
    >
      {permission.label}
    </span>
  );
}

function MatrixTable({ rows }: { rows: typeof pagePermissionRows }) {
  return (
    <div className="mt-5 overflow-x-auto">
      <table className="w-full min-w-[1120px] border-separate border-spacing-0 text-left">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 w-[220px] border-b border-border bg-[#fafcfe] px-4 py-3 text-[10px] font-medium text-muted-foreground">
              权限对象
            </th>
            {roles.map((role) => (
              <th
                className="border-b border-border bg-[#fafcfe] px-3 py-3 text-[10px] font-medium text-muted-foreground"
                key={role.id}
              >
                {role.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name}>
              <td className="sticky left-0 z-10 border-b border-border/80 bg-white px-4 py-4">
                <div className="text-xs font-semibold text-foreground">
                  {row.name}
                </div>
                <div className="mt-1 text-[10px] leading-4 text-muted-foreground">
                  {row.description}
                </div>
              </td>
              {roles.map((role) => (
                <td
                  className="border-b border-border/80 bg-white px-3 py-4"
                  key={role.id}
                >
                  <PermissionPill permission={row.permissions[role.id]} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function RolesPage({
  searchParams,
}: {
  searchParams: Promise<{
    rolesSaved?: string;
    rolesError?: string;
    temporarySaved?: string;
    temporaryRevoked?: string;
    temporaryError?: string;
  }>;
}) {
  const employee = await requireCurrentEmployee();
  const canView = employee.roleCodes.some((role) =>
    ["admin", "chairman"].includes(role),
  );
  const roleLabel = employee.roleCodes.includes("admin")
    ? employee.roleCodes.includes("chairman")
      ? "最高权限管理员"
      : "系统管理员"
    : "董事长";
  const canManage = employee.roleCodes.some((role) =>
    ["admin", "chairman"].includes(role),
  );
  const feedback = await searchParams;
  const supabase = await createClient();
  const now = new Date();
  const [{ data: versionData }, { data: employeeData }, { data: grantData }] =
    canView
      ? await Promise.all([
          supabase
            .from("permission_template_versions")
            .select(
              "id, template_key, version, change_note, created_at, creator:employees!permission_template_versions_created_by_employee_id_fkey(name)",
            )
            .eq("template_key", "core_rbac")
            .order("version", { ascending: false })
            .limit(5),
          canManage
            ? supabase
                .from("employees")
                .select(
                  "id, name, employee_no, title, employee_roles(role:roles(code, name))",
                )
                .eq("status", "active")
                .order("name")
            : Promise.resolve({ data: [] }),
          supabase
            .from("temporary_role_grants")
            .select(
              "id, expires_at, reason, created_at, employee:employees!temporary_role_grants_employee_id_fkey(id, name, employee_no), role:roles!temporary_role_grants_role_id_fkey(code, name), granter:employees!temporary_role_grants_granted_by_employee_id_fkey(name)",
            )
            .eq("status", "active")
            .gt("expires_at", now.toISOString())
            .order("expires_at"),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }];
  const templateVersions = (versionData ?? []) as TemplateVersion[];
  const employeeOptions = (employeeData ?? []) as EmployeeOption[];
  const temporaryGrants = (grantData ?? []) as TemporaryGrant[];
  const expiringSoon = temporaryGrants.filter(
    (grant) =>
      new Date(grant.expires_at).getTime() - now.getTime() <=
      24 * 60 * 60 * 1000,
  ).length;
  const temporaryFeedback = feedback.temporarySaved
    ? "临时角色已授予，到期后将自动失效。"
    : feedback.temporaryRevoked
      ? "临时角色已撤销。"
      : feedback.temporaryError
        ? {
            invalid_input: "请完整填写员工、角色、期限和授权原因。",
            invalid_reason: "授权或撤销原因至少需要 5 个字。",
            permanent_role: "该员工已经永久拥有此角色。",
            duplicate_grant: "该员工已有未到期的同角色授权。",
            forbidden_role: "系统管理员和董事长不能临时授予。",
            invalid_employee: "目标员工不存在或不在职。",
            forbidden: "当前账号无权管理临时授权。",
            operation_failed: "临时授权操作失败，请稍后重试。",
          }[feedback.temporaryError] ?? "临时授权操作失败，请稍后重试。"
        : "";
  const roleAssignmentFeedback = feedback.rolesSaved
    ? "员工权限已保存。董事长角色会自动获得全部权限。"
    : feedback.rolesError
      ? {
          invalid_roles: "权限选择不完整，请重新选择。",
          forbidden: "当前账号无权分配员工权限。",
          admin_protection: "不能移除当前账号的管理员权限。",
          last_admin: "必须保留至少一位在职系统管理员。",
          governance_protection: "必须保留至少一位在职董事长。",
          high_risk_confirmation:
            "新增或移除系统管理员、董事长时，必须输入该员工姓名确认。",
          operation_failed: "权限保存失败，请刷新后重试。",
        }[feedback.rolesError] ?? "权限保存失败，请刷新后重试。"
      : "";

  return (
    <WorkflowShell
      activeItem="系统管理"
      breadcrumb="系统管理 / 角色与权限"
      currentUser={{ name: employee.name, roleLabel }}
    >
      <main className="mx-auto max-w-[1600px] p-4 sm:p-6 xl:p-8">
        <section className="relative overflow-hidden rounded-[24px] bg-[#0a385d] px-6 py-7 text-white sm:px-8 lg:px-10">
          <ShieldCheck className="pointer-events-none absolute right-12 top-1/2 hidden size-40 -translate-y-1/2 text-white/[0.055] sm:block" />
          <div className="relative max-w-3xl">
            <div className="text-xs font-medium tracking-[0.12em] text-[#79d8d5]">
              ACCESS CONTROL · V3.0
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-[-0.035em] sm:text-[30px]">
              角色与权限矩阵
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-white/55">
              当前矩阵与线上角色代码保持一致。菜单只负责界面提示，实际访问仍由服务端授权和数据库
              RLS 控制。
            </p>
          </div>
        </section>

        {!canView ? (
          <section className="mt-5 rounded-[22px] border border-[#ead8d8] bg-white p-10 text-center">
            <LockKeyhole className="mx-auto size-7 text-[#965151]" />
            <h2 className="mt-4 text-base font-semibold">无权查看角色权限</h2>
            <p className="mt-2 text-xs text-muted-foreground">
              该页面仅向系统管理员和董事长开放。
            </p>
          </section>
        ) : (
          <>
            <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
              {roles.map((role) => (
                <article
                  className="rounded-[20px] border border-border/80 bg-white p-5"
                  key={role.id}
                >
                  <span
                    className={`grid size-10 place-items-center rounded-xl text-xs font-semibold ${role.accent}`}
                  >
                    {role.mark}
                  </span>
                  <h2 className="mt-4 text-sm font-semibold">{role.name}</h2>
                  <p className="mt-2 min-h-10 text-[10px] leading-5 text-muted-foreground">
                    {role.summary}
                  </p>
                  <div className="mt-4 border-t border-border/80 pt-3 text-[10px] text-primary">
                    {role.dataScope}
                  </div>
                </article>
              ))}
            </section>

            <section
              className="mt-5 rounded-[22px] border border-border/80 bg-white p-5 sm:p-6"
              id="employee-permissions"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <UserRoundCheck className="size-4 text-primary" />
                    <h2 className="text-base font-semibold">员工权限分配</h2>
                  </div>
                  <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
                    按员工分配长期角色权限。普通员工为基础角色；选择董事长后，系统会自动授予全部角色和权限。
                  </p>
                </div>
                <span className="rounded-full bg-[#eef8f5] px-3 py-1.5 text-[10px] text-[#285f53]">
                  在职员工 {employeeOptions.length}
                </span>
              </div>

              {roleAssignmentFeedback && (
                <div
                  className={`mt-4 rounded-xl px-4 py-3 text-[10px] ${
                    feedback.rolesError
                      ? "border border-[#ead8d8] bg-[#f8eeee] text-[#965151]"
                      : "border border-[#b9dbce] bg-[#eef8f5] text-[#285f53]"
                  }`}
                >
                  {roleAssignmentFeedback}
                </div>
              )}

              {!canManage ? (
                <div className="mt-5 rounded-xl bg-[#f8fafb] px-4 py-6 text-center text-xs text-muted-foreground">
                  只有系统管理员或董事长可以分配员工权限。
                </div>
              ) : employeeOptions.length === 0 ? (
                <div className="mt-5 rounded-xl bg-[#f8fafb] px-4 py-6 text-center text-xs text-muted-foreground">
                  当前没有可分配权限的在职员工。
                </div>
              ) : (
                <div className="mt-5 space-y-3">
                  {employeeOptions.map((target) => {
                    const assignedCodes = employeeRoleCodes(target);
                    const assignedNames = roles
                      .filter((role) => assignedCodes.includes(role.id))
                      .map((role) => role.name);

                    return (
                      <details
                        className="rounded-2xl border border-border/80 bg-[#fafcfe] open:bg-white"
                        key={target.id}
                      >
                        <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 px-4 py-4">
                          <span className="grid size-9 place-items-center rounded-xl bg-[#eaf3f8] text-xs font-semibold text-primary">
                            {target.name.slice(0, 1)}
                          </span>
                          <span className="min-w-[160px] flex-1">
                            <span className="block text-xs font-semibold">
                              {target.name}
                            </span>
                            <span className="mt-1 block text-[9px] text-muted-foreground">
                              {target.employee_no} · {target.title ?? "未设置职位"}
                            </span>
                          </span>
                          <span className="text-[9px] text-muted-foreground">
                            {assignedNames.length > 0
                              ? assignedNames.join("、")
                              : "尚未分配"}
                          </span>
                        </summary>

                        <form
                          action={saveEmployeeRolesAction}
                          className="border-t border-border/70 p-4"
                        >
                          <input name="employeeId" type="hidden" value={target.id} />
                          <input name="returnTo" type="hidden" value="roles" />
                          <input name="roleCodes" type="hidden" value="employee" />
                          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                            {roles.map((role) =>
                              role.id === "employee" ? (
                                <div
                                  className="flex items-center gap-2 rounded-xl border border-[#b9dbce] bg-[#eef8f5] px-3 py-3 text-[10px] text-[#285f53]"
                                  key={role.id}
                                >
                                  <input checked readOnly type="checkbox" />
                                  {role.name}（必选）
                                </div>
                              ) : (
                                <label
                                  className="flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-white px-3 py-3 text-[10px]"
                                  key={role.id}
                                >
                                  <input
                                    defaultChecked={assignedCodes.includes(role.id)}
                                    name="roleCodes"
                                    type="checkbox"
                                    value={role.id}
                                  />
                                  {role.name}
                                </label>
                              ),
                            )}
                          </div>

                          <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
                            <label className="rounded-xl border border-[#f0dec5] bg-[#fff9ef] p-3">
                              <span className="block text-[9px] font-medium text-[#9a6321]">
                                高风险变更确认
                              </span>
                              <span className="mt-1 block text-[9px] leading-4 text-muted-foreground">
                                新增或移除系统管理员、董事长时，请输入“{target.name}”。
                              </span>
                              <input
                                autoComplete="off"
                                className="mt-2 h-8 w-full rounded-lg border border-[#ead8b8] bg-white px-2.5 text-[9px] outline-none focus:border-[#c89a52]"
                                name="highRiskConfirmation"
                                placeholder={`输入 ${target.name} 确认`}
                              />
                            </label>
                            <button
                              className="h-9 rounded-xl bg-primary px-5 text-[10px] font-medium text-white"
                              type="submit"
                            >
                              保存该员工权限
                            </button>
                          </div>
                        </form>
                      </details>
                    );
                  })}
                </div>
              )}
            </section>

            <section
              className="mt-5 rounded-[22px] border border-border/80 bg-white p-5 sm:p-6"
              id="temporary-grants"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Clock3 className="size-4 text-primary" />
                    <h2 className="text-base font-semibold">临时角色授权</h2>
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    仅支持部门负责人、人事和财务角色，最长 30 天，到期即时失效。
                  </p>
                </div>
                <div className="flex gap-2 text-[10px]">
                  <span className="rounded-full bg-[#eaf3f8] px-3 py-1.5 text-primary">
                    生效中 {temporaryGrants.length}
                  </span>
                  <span className="rounded-full bg-[#fff4e7] px-3 py-1.5 text-[#9a6321]">
                    24 小时内到期 {expiringSoon}
                  </span>
                </div>
              </div>

              {temporaryFeedback && (
                <div
                  className={`mt-4 rounded-xl px-4 py-3 text-[10px] ${
                    feedback.temporaryError
                      ? "border border-[#ead8d8] bg-[#f8eeee] text-[#965151]"
                      : "border border-[#b9dbce] bg-[#eef8f5] text-[#285f53]"
                  }`}
                >
                  {temporaryFeedback}
                </div>
              )}

              {canManage && (
                <form
                  action={grantTemporaryRoleAction}
                  className="mt-5 grid gap-3 rounded-2xl border border-border/80 bg-[#fafcfe] p-4 lg:grid-cols-[1.2fr_1fr_.8fr_1.6fr_auto] lg:items-end"
                >
                  <label className="text-[10px]">
                    <span className="font-medium">目标员工</span>
                    <select
                      className="mt-2 h-9 w-full rounded-lg border border-border bg-white px-2 text-[10px]"
                      name="employeeId"
                      required
                    >
                      <option value="">请选择</option>
                      {employeeOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.name} · {option.employee_no}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-[10px]">
                    <span className="font-medium">临时角色</span>
                    <select
                      className="mt-2 h-9 w-full rounded-lg border border-border bg-white px-2 text-[10px]"
                      name="roleCode"
                      required
                    >
                      <option value="department_lead">部门负责人</option>
                      <option value="hr">人事行政</option>
                      <option value="finance">财务</option>
                    </select>
                  </label>
                  <label className="text-[10px]">
                    <span className="font-medium">有效期</span>
                    <select
                      className="mt-2 h-9 w-full rounded-lg border border-border bg-white px-2 text-[10px]"
                      name="durationHours"
                      required
                    >
                      <option value="8">8 小时</option>
                      <option value="24">1 天</option>
                      <option value="72">3 天</option>
                      <option value="168">7 天</option>
                      <option value="720">30 天</option>
                    </select>
                  </label>
                  <label className="text-[10px]">
                    <span className="font-medium">授权原因</span>
                    <input
                      className="mt-2 h-9 w-full rounded-lg border border-border bg-white px-3 text-[10px]"
                      maxLength={200}
                      minLength={5}
                      name="reason"
                      placeholder="说明业务场景和必要性"
                      required
                    />
                  </label>
                  <button
                    className="h-9 rounded-lg bg-primary px-4 text-[10px] font-medium text-white"
                    type="submit"
                  >
                    授予
                  </button>
                </form>
              )}

              <div className="mt-5 overflow-hidden rounded-xl border border-border/80">
                {temporaryGrants.length === 0 ? (
                  <div className="py-10 text-center text-xs text-muted-foreground">
                    当前没有生效中的临时授权
                  </div>
                ) : (
                  temporaryGrants.map((grant) => {
                    const target = relationOne(grant.employee);
                    const role = relationOne(grant.role);
                    const granter = relationOne(grant.granter);
                    return (
                      <div
                        className="flex flex-wrap items-center gap-4 border-b border-border/70 px-4 py-4 last:border-b-0"
                        key={grant.id}
                      >
                        <span className="grid size-9 place-items-center rounded-xl bg-[#fff4e7] text-[#9a6321]">
                          <ShieldAlert className="size-4" />
                        </span>
                        <div className="min-w-[180px] flex-1">
                          <div className="text-xs font-semibold">
                            {target?.name ?? "未知员工"} · {role?.name ?? role?.code}
                          </div>
                          <div className="mt-1 text-[9px] text-muted-foreground">
                            授权人 {granter?.name ?? "系统"} · 到期 {formatDateTime(grant.expires_at)}
                          </div>
                          <div className="mt-1 text-[9px] text-muted-foreground">
                            原因：{grant.reason}
                          </div>
                        </div>
                        {canManage && (
                          <form
                            action={revokeTemporaryRoleAction}
                            className="flex items-center gap-2"
                          >
                            <input name="grantId" type="hidden" value={grant.id} />
                            <input
                              className="h-8 w-48 rounded-lg border border-border px-2 text-[9px]"
                              maxLength={200}
                              minLength={5}
                              name="reason"
                              placeholder="填写撤销原因"
                              required
                            />
                            <button
                              className="h-8 rounded-lg border border-[#ead8d8] px-3 text-[9px] text-[#965151]"
                              type="submit"
                            >
                              立即撤销
                            </button>
                          </form>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </section>

            <section className="mt-5 rounded-[22px] border border-border/80 bg-white p-5 sm:p-6">
              <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <KeyRound className="size-4 text-primary" />
                    <h2 className="text-base font-semibold">页面访问权限</h2>
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    同一页面会根据角色呈现不同的数据范围。
                  </p>
                </div>
                <div className="flex max-w-2xl flex-wrap gap-2">
                  {permissionLegend.map((item) => (
                    <PermissionPill
                      key={item.level}
                      permission={{ level: item.level, label: item.label }}
                    />
                  ))}
                </div>
              </div>
              <MatrixTable rows={pagePermissionRows} />
            </section>

            <section className="mt-5 rounded-[22px] border border-border/80 bg-white p-5 sm:p-6">
              <div className="flex items-center gap-2">
                <UserRoundCheck className="size-4 text-primary" />
                <h2 className="text-base font-semibold">操作权限</h2>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                页面可见不代表可以编辑、审批、导出或删除。
              </p>
              <MatrixTable rows={operationPermissionRows} />
            </section>

            <section className="mt-5 rounded-[22px] border border-border/80 bg-white p-5 sm:p-6">
              <div className="flex items-center gap-2">
                <EyeOff className="size-4 text-primary" />
                <h2 className="text-base font-semibold">敏感字段权限</h2>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                敏感字段单独授权，不随管理员身份自动开放。
              </p>
              <MatrixTable rows={sensitiveFieldRows} />
            </section>

            <section className="mt-5 rounded-[22px] border border-border/80 bg-white p-5 sm:p-6">
              <div className="flex items-center gap-2">
                <History className="size-4 text-primary" />
                <h2 className="text-base font-semibold">权限模板版本</h2>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                每次权限模型发布都会保留组织级快照，便于审计和回溯。
              </p>
              {templateVersions.length === 0 ? (
                <div className="mt-5 rounded-xl bg-[#f8fafb] px-4 py-6 text-center text-xs text-muted-foreground">
                  暂无权限模板版本
                </div>
              ) : (
                <div className="mt-5 overflow-hidden rounded-xl border border-border/80">
                  {templateVersions.map((version, index) => (
                    <div
                      className="flex flex-wrap items-center gap-3 border-b border-border/70 px-4 py-3 last:border-b-0"
                      key={version.id}
                    >
                      <span className="rounded-lg bg-[#eaf3f8] px-2.5 py-1 text-[10px] font-semibold text-primary">
                        v{version.version}
                      </span>
                      <div className="min-w-[200px] flex-1">
                        <div className="text-xs font-medium">
                          {version.change_note}
                        </div>
                        <div className="mt-1 text-[9px] text-muted-foreground">
                          {creatorName(version)} · {new Intl.DateTimeFormat("zh-CN", {
                            timeZone: "Asia/Shanghai",
                            year: "numeric",
                            month: "2-digit",
                            day: "2-digit",
                          }).format(new Date(version.created_at))}
                        </div>
                      </div>
                      {index === 0 && (
                        <span className="rounded-full bg-[#eef8f5] px-2.5 py-1 text-[9px] text-[#285f53]">
                          当前版本
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="mt-5 rounded-[20px] border border-[#b9dbce] bg-[#eef8f5] p-5 text-xs leading-6 text-[#285f53]">
              当前状态：账号角色绑定、服务端授权函数和数据库 RLS
              已接入；临时授权、自动到期、主动撤销和全链路审计已启用。
            </section>
          </>
        )}
      </main>
    </WorkflowShell>
  );
}
