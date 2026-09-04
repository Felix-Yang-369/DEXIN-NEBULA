import type { Metadata } from "next";
import Link from "next/link";
import {
  BellRing,
  ChevronRight,
  ClipboardCheck,
  DatabaseZap,
  Gauge,
  PanelsTopLeft,
  Printer,
  Network,
  ScrollText,
  Settings2,
  ShieldCheck,
  UserCog,
} from "lucide-react";
import { WorkflowShell } from "@/features/approvals/workflow-shell";
import { requireCurrentEmployee } from "@/features/auth/current-employee";

export const metadata: Metadata = {
  title: "系统管理",
  description: "德馨星云组织账号、权限、流程、消息、配置和审计入口",
};

const systemModules = [
  { title: "组织与账号", description: "组织、部门、员工账号与启停状态", href: "/employees", icon: UserCog },
  { title: "权限中心 V2", description: "自定义角色、权限编码、数据范围与最终权限查询", href: "/system/permissions", icon: ShieldCheck },
  { title: "审批流程 V2", description: "版本化路线、金额条件、负责人解析与办理时限", href: "/system/approvals", icon: ClipboardCheck },
  { title: "主数据质量", description: "质量规则、问题分派、修复与复核闭环", href: "/system/data-quality", icon: DatabaseZap },
  { title: "性能监控", description: "接口延迟、错误率与慢查询治理", href: "/system/observability", icon: Gauge },
  { title: "表单设计器", description: "版本化字段、校验规则与内部表单", href: "/system/forms", icon: PanelsTopLeft },
  { title: "打印模板", description: "单据版式、Logo、水印与打印策略", href: "/system/print-templates", icon: Printer },
  { title: "消息通知", description: "站内通知与业务状态提醒", href: "/notifications", icon: BellRing },
  { title: "系统配置", description: "组织级参数与模块配置，逐步建设", href: "/help", icon: Settings2 },
  { title: "操作日志", description: "关键业务和权限操作审计记录", href: "/audit", icon: ScrollText },
] as const;

export default async function SystemPage() {
  const employee = await requireCurrentEmployee();
  const canView = employee.roleCodes.some((role) =>
    ["admin", "chairman"].includes(role),
  );

  return (
    <WorkflowShell
      activeItem="系统管理"
      breadcrumb="系统管理 / 总览"
      currentUser={{ name: employee.name, roleLabel: employee.title ?? "内部员工" }}
    >
      <main className="mx-auto max-w-[1200px] p-4 sm:p-6 xl:p-8">
        <section className="rounded-[24px] bg-[#0a385d] px-6 py-8 text-white sm:px-8">
          <div className="text-[10px] tracking-[0.15em] text-[#79d8d5]">
            SYSTEM · IAM · BPM · AUDIT
          </div>
          <h1 className="mt-3 text-2xl font-semibold">系统管理</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-white/55">
            管理组织账号、角色权限、审批流程、消息通知、系统参数与操作审计。
          </p>
        </section>

        {!canView ? (
          <div className="mt-5 rounded-[18px] border border-[#ead8d8] bg-white p-8 text-center text-xs text-[#965151]">
            系统管理仅向系统管理员和董事长开放。
          </div>
        ) : (
          <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {systemModules.map((module) => {
              const Icon = module.icon;
              return (
                <Link className="group rounded-[20px] border border-border bg-white p-5" href={module.href} key={module.title}>
                  <div className="flex items-start justify-between">
                    <span className="grid size-10 place-items-center rounded-xl bg-[#eaf3f8] text-primary">
                      <Icon className="size-5" />
                    </span>
                    <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </div>
                  <h2 className="mt-4 text-sm font-semibold">{module.title}</h2>
                  <p className="mt-2 text-[10px] leading-5 text-muted-foreground">{module.description}</p>
                </Link>
              );
            })}
          </section>
        )}

        <div className="mt-5 flex items-center gap-3 rounded-[18px] border border-border bg-[#eef4f8] p-4 text-[10px] text-[#5c7587]">
          <Network className="size-4 text-primary" />
          HRM 管理员工任职与人事档案；系统管理负责账号、权限和平台运行配置，两者共享同一组织主数据。
        </div>
      </main>
    </WorkflowShell>
  );
}
