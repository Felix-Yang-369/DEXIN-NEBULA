import type { Metadata } from "next";
import {
  EyeOff,
  KeyRound,
  LockKeyhole,
  ShieldCheck,
  UserRoundCheck,
} from "lucide-react";
import { NebulaLogo } from "@/components/brand/nebula-logo";
import { PlatformSidebarMenu } from "@/components/navigation/platform-sidebar-menu";
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

function MatrixTable({
  rows,
}: {
  rows: typeof pagePermissionRows;
}) {
  return (
    <div className="mt-5 overflow-x-auto">
      <table className="w-full min-w-[980px] border-separate border-spacing-0 text-left">
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

export default function RolesPage() {
  return (
    <div className="min-h-svh bg-[#f5f8fb] text-foreground">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[252px] flex-col border-r border-white/8 bg-[#102f2c] px-4 py-5 text-white lg:flex">
        <div className="px-2">
          <NebulaLogo inverse />
        </div>
        <PlatformSidebarMenu
          activeItem="系统管理"
          breadcrumb="系统管理 / 角色与权限"
        />
        <div className="rounded-2xl border border-white/10 bg-white/[0.055] p-3">
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-xl bg-[#6bd7d4] text-xs font-semibold text-[#0b3152]">
              杨
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium">系统管理员</div>
              <div className="mt-0.5 truncate text-[10px] text-white/38">
                德馨淼盛
              </div>
            </div>
            <span className="text-white/28">•••</span>
          </div>
        </div>
      </aside>

      <div className="lg:pl-[252px]">
        <header className="sticky top-0 z-20 flex h-[72px] items-center border-b border-border/80 bg-white/88 px-4 backdrop-blur-xl sm:px-6 xl:px-8">
          <div className="lg:hidden">
            <NebulaLogo compact />
          </div>
          <div className="ml-3 hidden text-xs text-muted-foreground md:block lg:ml-0">
            德馨星云 / 组织协同 / 角色与权限
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden rounded-xl border border-border bg-white px-3 py-2 text-[10px] text-muted-foreground sm:block">
              权限策略版本：V0.1
            </div>
            <div className="grid size-8 place-items-center rounded-xl bg-primary text-[10px] font-semibold text-primary-foreground">
              杨
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1600px] p-4 sm:p-6 xl:p-8">
          <section className="relative overflow-hidden rounded-[24px] bg-[#0a385d] px-6 py-7 text-white shadow-[0_18px_50px_-32px_rgba(12,47,41,.75)] sm:px-8 lg:px-10">
            <div className="absolute -right-16 -top-24 size-72 rounded-full border border-white/8" />
            <ShieldCheck className="pointer-events-none absolute right-12 top-1/2 hidden size-40 -translate-y-1/2 text-white/[0.055] sm:block" />
            <div className="relative max-w-3xl">
              <div className="text-xs font-medium tracking-[0.12em] text-[#79d8d5]">
                ACCESS CONTROL · V0.1
              </div>
              <h1 className="mt-3 text-2xl font-semibold tracking-[-0.035em] sm:text-[30px]">
                角色与权限矩阵
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/55">
                从页面访问、业务操作、数据范围和敏感字段四个维度定义权限。
                当前页面是 V1 权限实施基线，服务端与数据库策略接入后才会正式生效。
              </p>
            </div>
          </section>

          <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {roles.map((role) => (
              <article
                className="rounded-[20px] border border-border/80 bg-white p-5 shadow-[0_8px_30px_-24px_rgba(23,57,50,.35)]"
                key={role.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <span
                    className={`grid size-10 place-items-center rounded-xl text-xs font-semibold ${role.accent}`}
                  >
                    {role.mark}
                  </span>
                  <span className="rounded-full bg-[#f3f6f5] px-2 py-1 font-mono text-[8px] text-muted-foreground">
                    {role.code}
                  </span>
                </div>
                <h2 className="mt-4 text-sm font-semibold">{role.name}</h2>
                <p className="mt-2 min-h-10 text-[10px] leading-5 text-muted-foreground">
                  {role.summary}
                </p>
                <div className="mt-4 border-t border-border/80 pt-3 text-[10px]">
                  <span className="text-muted-foreground">默认数据范围</span>
                  <span className="ml-2 font-medium text-primary">
                    {role.dataScope}
                  </span>
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
                <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
                  同一页面会根据角色呈现不同的数据范围和管理能力。
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

          <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-5">
              <section className="rounded-[22px] border border-border/80 bg-white p-5 sm:p-6">
                <div className="flex items-center gap-2">
                  <UserRoundCheck className="size-4 text-primary" />
                  <h2 className="text-base font-semibold">操作权限</h2>
                </div>
                <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
                  页面可见不代表可以编辑、审批、导出或删除。
                </p>
                <MatrixTable rows={operationPermissionRows} />
              </section>

              <section className="rounded-[22px] border border-border/80 bg-white p-5 sm:p-6">
                <div className="flex items-center gap-2">
                  <EyeOff className="size-4 text-primary" />
                  <h2 className="text-base font-semibold">敏感字段权限</h2>
                </div>
                <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
                  敏感字段单独授权，不随页面权限或管理员身份自动开放。
                </p>
                <MatrixTable rows={sensitiveFieldRows} />
              </section>
            </div>

            <aside className="space-y-5">
              <section className="rounded-[22px] border border-border/80 bg-white p-5">
                <div className="flex items-center gap-2">
                  <LockKeyhole className="size-4 text-primary" />
                  <h2 className="text-sm font-semibold">数据范围规则</h2>
                </div>
                <div className="mt-5 space-y-4">
                  {[
                    ["本人", "仅本人创建、负责或归属的记录"],
                    ["本部门", "当前所属部门，不自动包含其他部门"],
                    ["全公司", "组织范围内数据，仍受敏感字段限制"],
                    ["配置数据", "账号、角色、流程和日志等系统数据"],
                  ].map(([title, copy], index) => (
                    <div className="flex gap-3" key={title}>
                      <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-[#eef4f8] text-[9px] font-semibold text-primary">
                        0{index + 1}
                      </span>
                      <div>
                        <div className="text-xs font-semibold">{title}</div>
                        <p className="mt-1 text-[10px] leading-5 text-muted-foreground">
                          {copy}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-[22px] bg-[#0a385d] p-5 text-white">
                <div className="text-[10px] font-medium tracking-[0.14em] text-[#79d8d5]">
                  SECURITY BASELINE
                </div>
                <h2 className="mt-3 text-sm font-semibold">四条实施原则</h2>
                <ul className="mt-4 space-y-3 text-[10px] leading-5 text-white/58">
                  <li>● 默认拒绝，按最小必要范围授权。</li>
                  <li>● 权限在服务端和数据访问层再次校验。</li>
                  <li>● 敏感字段独立授权并默认脱敏。</li>
                  <li>● 授权、导出、审批和归档写入审计日志。</li>
                </ul>
                <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.06] p-3 text-[10px] leading-5 text-white/48">
                  系统管理员负责系统配置，不等同于业务数据超级用户。
                </div>
              </section>

              <section className="rounded-[20px] border border-[#f0dfc7] bg-[#fff8ee] p-5">
                <div className="text-xs font-semibold text-[#8b612c]">
                  当前实施状态
                </div>
                <p className="mt-2 text-[10px] leading-5 text-[#8b6d46]">
                  本页已形成权限设计基线；账号角色绑定、服务端授权函数、数据库行级策略和审计日志尚待后端接入。
                </p>
              </section>
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
}
