import type { Metadata } from "next";
import { AppShellClient } from "@/components/navigation/app-shell-client";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import { WorkflowShell } from "@/features/approvals/workflow-shell";
import { ConnectedEmployeeManagement } from "@/features/employees/connected-employee-management";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  navigationGroupsForRoles,
  splitNavigationGroups,
} from "@/config/platform-navigation";

export const metadata: Metadata = {
  title: "员工档案",
  description: "德馨淼盛员工档案、账号和入职流程管理",
};

const demoNavigation = splitNavigationGroups(
  navigationGroupsForRoles(["admin"]),
);

const archiveGroups = [
  {
    name: "基本信息",
    progress: "4 项",
    fields: ["姓名", "员工编号", "联系方式", "出生日期"],
    tone: "bg-[#eaf3f8] text-primary",
    mark: "基",
  },
  {
    name: "任职信息",
    progress: "6 项",
    fields: ["部门", "职位", "直属负责人", "入职日期", "员工状态", "办公地点"],
    tone: "bg-[#edf2f7] text-[#42647a]",
    mark: "职",
  },
  {
    name: "合同信息",
    progress: "4 项",
    fields: ["合同类型", "起止日期", "试用期", "合同附件"],
    tone: "bg-[#fff4e7] text-[#9a6321]",
    mark: "合",
  },
  {
    name: "假期账户",
    progress: "3 项",
    fields: ["年假余额", "调休余额", "其他假期"],
    tone: "bg-[#f3eef8] text-[#77518e]",
    mark: "假",
  },
];

const onboardingSteps = [
  { label: "创建员工档案", status: "待处理", mark: "1" },
  { label: "分配部门与职位", status: "待处理", mark: "2" },
  { label: "创建登录账号", status: "待认证接入", mark: "3" },
  { label: "授予角色权限", status: "待处理", mark: "4" },
  { label: "发送入职通知", status: "待通知接入", mark: "5" },
];

const protectionItems = [
  ["身份证号", "默认脱敏"],
  ["银行卡号", "默认隐藏"],
  ["员工合同", "人事可见"],
  ["工资信息", "独立授权"],
];

export const dynamic = "force-dynamic";

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{
    saved?: string;
    rolesSaved?: string;
    accountLinked?: string;
    avatarSaved?: string;
    error?: string;
  }>;
}) {
  if (!isSupabaseConfigured()) {
    return <EmployeesDemoPage />;
  }

  const employee = await requireCurrentEmployee();
  const feedback = await searchParams;

  return (
    <WorkflowShell
      activeItem="人力资源"
      breadcrumb="组织运营 / 人力资源 / 员工档案"
      currentUser={{
        name: employee.name,
        roleLabel: employee.title ?? "内部员工",
      }}
    >
      <ConnectedEmployeeManagement
        currentEmployee={employee}
        feedback={feedback}
      />
    </WorkflowShell>
  );
}

function EmployeesDemoPage() {
  return (
    <AppShellClient
      activeItem="人力资源"
      avatarUrl={null}
      bottomGroups={demoNavigation.bottomGroups}
      breadcrumb="组织运营 / 人力资源 / 员工档案"
      displayName="系统管理员"
      density="comfortable"
      hiddenInitially={false}
      mainGroups={demoNavigation.mainGroups}
      roleLabel="演示环境"
      sidebarMode="expanded"
      unreadCount={0}
    >
      <main className="mx-auto max-w-[1600px] p-4 sm:p-6 xl:p-8">
          <section className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div>
              <div className="text-xs font-medium text-primary">EMPLOYEE CENTER</div>
              <h1 className="mt-2 text-2xl font-semibold tracking-[-0.035em] sm:text-[30px]">
                员工中心
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                统一管理员工档案、任职关系、账号状态、合同与假期账户。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                className="h-10 rounded-xl border border-border bg-card px-4 text-xs font-medium"
                type="button"
              >
                批量导入
              </button>
              <button
                className="h-10 rounded-xl bg-primary px-4 text-xs font-medium text-primary-foreground shadow-[0_12px_28px_-16px_var(--brand-shadow)]"
                type="button"
              >
                ＋ 新建员工
              </button>
            </div>
          </section>

          <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["—", "员工总数", "导入后自动统计"],
              ["—", "已启用账号", "认证接入后统计"],
              ["0", "待入职", "当前没有待办"],
              ["—", "合同即将到期", "合同数据接入后提醒"],
            ].map(([value, label, note]) => (
              <article
                className="rounded-[18px] border border-border/75 bg-card p-5"
                key={label}
              >
                <div className="text-[26px] font-semibold tracking-[-0.04em]">
                  {value}
                </div>
                <div className="mt-2 text-xs font-medium">{label}</div>
                <div className="mt-1 text-[10px] text-muted-foreground">{note}</div>
              </article>
            ))}
          </section>

          <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,.55fr)]">
            <div className="space-y-5">
              <section className="overflow-hidden rounded-[20px] border border-border/75 bg-card">
                <div className="border-b border-border/70 p-5 sm:px-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-base font-semibold tracking-[-0.02em]">
                        员工列表
                      </h2>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        当前未导入真实员工资料
                      </p>
                    </div>
                    <div className="flex rounded-xl bg-muted p-1 text-[10px]">
                      <button
                        className="rounded-lg bg-white px-3 py-1.5 font-medium text-primary shadow-sm"
                        type="button"
                      >
                        在职
                      </button>
                      <button
                        className="px-3 py-1.5 text-muted-foreground"
                        type="button"
                      >
                        试用
                      </button>
                      <button
                        className="px-3 py-1.5 text-muted-foreground"
                        type="button"
                      >
                        实习
                      </button>
                      <button
                        className="px-3 py-1.5 text-muted-foreground"
                        type="button"
                      >
                        兼职
                      </button>
                      <button
                        className="px-3 py-1.5 text-muted-foreground"
                        type="button"
                      >
                        已离职
                      </button>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {["全部部门", "全部职位", "全部账号状态"].map((filter) => (
                      <button
                        className="h-8 rounded-lg border border-border bg-[#fafcfe] px-3 text-[10px] text-muted-foreground"
                        type="button"
                        key={filter}
                      >
                        {filter}　⌄
                      </button>
                    ))}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[860px] border-collapse text-left">
                    <thead>
                      <tr className="border-b border-border/70 bg-[#fafcfe] text-[10px] font-medium text-muted-foreground">
                        <th className="px-6 py-3">员工</th>
                        <th className="px-4 py-3">员工编号</th>
                        <th className="px-4 py-3">部门 / 职位</th>
                        <th className="px-4 py-3">入职日期</th>
                        <th className="px-4 py-3">员工状态</th>
                        <th className="px-4 py-3">账号状态</th>
                        <th className="px-6 py-3 text-right">操作</th>
                      </tr>
                    </thead>
                  </table>
                </div>

                <div className="px-6 py-16 text-center">
                  <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#eaf3f8] text-sm font-semibold text-primary">
                    员
                  </div>
                  <h3 className="mt-4 text-sm font-medium">尚未导入员工资料</h3>
                  <p className="mx-auto mt-2 max-w-sm text-[11px] leading-5 text-muted-foreground">
                    请先确认组织架构，再使用标准模板导入员工。身份证、银行卡和合同等敏感信息不会进入普通导入模板。
                  </p>
                  <div className="mt-5 flex justify-center gap-2">
                    <button
                      className="h-9 rounded-xl border border-border bg-white px-4 text-[10px] font-medium"
                      type="button"
                    >
                      下载模板
                    </button>
                    <button
                      className="h-9 rounded-xl bg-primary px-4 text-[10px] font-medium text-primary-foreground"
                      type="button"
                    >
                      开始导入
                    </button>
                  </div>
                </div>
              </section>

              <section className="rounded-[20px] border border-border/75 bg-card p-5 sm:p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-base font-semibold tracking-[-0.02em]">
                      员工档案结构
                    </h2>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      字段分组便于按角色控制查看和编辑权限
                    </p>
                  </div>
                  <button
                    className="text-[11px] font-medium text-primary"
                    type="button"
                  >
                    字段设置
                  </button>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {archiveGroups.map((group) => (
                    <article
                      className="rounded-2xl border border-border/70 bg-[#fbfcfc] p-4"
                      key={group.name}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`grid size-8 place-items-center rounded-xl text-[10px] font-semibold ${group.tone}`}
                        >
                          {group.mark}
                        </span>
                        <span className="text-[9px] text-muted-foreground">
                          {group.progress}
                        </span>
                      </div>
                      <h3 className="mt-4 text-xs font-medium">{group.name}</h3>
                      <p className="mt-2 text-[9px] leading-5 text-muted-foreground">
                        {group.fields.join(" · ")}
                      </p>
                    </article>
                  ))}
                </div>
              </section>
            </div>

            <div className="space-y-5">
              <section className="rounded-[20px] border border-border/75 bg-card p-5 sm:p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-base font-semibold tracking-[-0.02em]">
                      入职流程
                    </h2>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      账号与权限必须在档案确认后创建
                    </p>
                  </div>
                  <span className="rounded-full bg-[#eaf3f8] px-2.5 py-1 text-[9px] font-medium text-primary">
                    标准流程
                  </span>
                </div>
                <div className="mt-5 space-y-3">
                  {onboardingSteps.map((step, index) => (
                    <div
                      className="flex items-center gap-3 rounded-xl border border-border/70 bg-[#fbfcfc] p-3"
                      key={step.mark}
                    >
                      <span
                        className={`grid size-7 place-items-center rounded-lg text-[9px] font-semibold ${
                          index === 0
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {step.mark}
                      </span>
                      <span className="min-w-0 flex-1 text-[11px] font-medium">
                        {step.label}
                      </span>
                      <span className="text-[9px] text-muted-foreground">
                        {step.status}
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-[20px] bg-[#0a385d] p-5 text-white sm:p-6">
                <div className="text-[10px] font-medium tracking-[0.14em] text-[#79d8d5]">
                  PRIVACY BY DEFAULT
                </div>
                <h2 className="mt-3 text-base font-semibold">敏感信息保护</h2>
                <div className="mt-4 divide-y divide-white/8">
                  {protectionItems.map(([field, policy]) => (
                    <div
                      className="flex items-center justify-between py-3 text-[10px]"
                      key={field}
                    >
                      <span className="text-white/62">{field}</span>
                      <span className="text-[#79d8d5]">{policy}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-[10px] leading-5 text-white/40">
                  服务端权限与操作日志完成前，不录入真实敏感信息。
                </p>
              </section>

              <section className="rounded-[20px] border border-[#f0dfc7] bg-[#fff8ee] p-5">
                <div className="text-xs font-medium text-[#8b612c]">
                  账号创建暂不可用
                </div>
                <p className="mt-2 text-[10px] leading-5 text-[#8b6d46]">
                  Supabase 身份认证尚未配置，因此不能创建真实账号或发送登录邀请。
                </p>
              </section>
            </div>
          </div>
      </main>
    </AppShellClient>
  );
}
