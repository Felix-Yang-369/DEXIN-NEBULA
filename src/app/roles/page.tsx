import type { Metadata } from "next";
import {
  EyeOff,
  KeyRound,
  LockKeyhole,
  ShieldCheck,
  UserRoundCheck,
} from "lucide-react";
import { WorkflowShell } from "@/features/approvals/workflow-shell";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import {
  operationPermissionRows,
  pagePermissionRows,
  permissionLegend,
  roles,
  sensitiveFieldRows,
  type PermissionCell,
  type PermissionLevel,
} from "@/features/permissions/role-permission-matrix";

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

export default async function RolesPage() {
  const employee = await requireCurrentEmployee();
  const canView = employee.roleCodes.some((role) =>
    ["admin", "chairman"].includes(role),
  );
  const roleLabel = employee.roleCodes.includes("admin")
    ? employee.roleCodes.includes("chairman")
      ? "最高权限管理员"
      : "系统管理员"
    : "董事长";

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
              ACCESS CONTROL · V1.0
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

            <section className="mt-5 rounded-[20px] border border-[#b9dbce] bg-[#eef8f5] p-5 text-xs leading-6 text-[#285f53]">
              当前状态：账号角色绑定、服务端授权函数和数据库 RLS
              已接入；后续继续建设原子权限目录、临时授权和高风险变更复核。
            </section>
          </>
        )}
      </main>
    </WorkflowShell>
  );
}
