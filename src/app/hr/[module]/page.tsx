import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  Clock3,
  LockKeyhole,
} from "lucide-react";
import { WorkflowShell } from "@/features/approvals/workflow-shell";
import { requireCurrentEmployee } from "@/features/auth/current-employee";

export const metadata: Metadata = {
  title: "HRM 子模块",
  description: "德馨星云人力资源管理子模块",
};

const modules = {
  recruitment: {
    title: "招聘管理",
    english: "Recruitment",
    stage: "规划中",
    description: "从招聘需求、候选人、面试到 Offer 和入职转化的人才获取流程。",
    roles: ["hr", "chairman"],
    capabilities: [
      ["招聘需求", "岗位、人数、到岗时间与审批"],
      ["候选人库", "简历来源、阶段、标签与负责人"],
      ["面试安排", "面试官、时间、评价与结果"],
      ["Offer 管理", "录用条件、审批、发送与接受状态"],
    ],
    nextAction: "进入正式开发前，先确认德馨现阶段招聘流程和简历来源。",
  },
  onboarding: {
    title: "入职离职",
    english: "Onboarding & Offboarding",
    stage: "下一阶段",
    description: "将资料、合同、设备、企业微信、邮箱、系统权限和工作交接变成标准清单。",
    roles: ["hr", "chairman"],
    capabilities: [
      ["入职资料", "员工档案、照片、合同和紧急资料核验"],
      ["账号开通", "企业邮箱、企业微信、德馨星云和角色权限"],
      ["资产发放", "电脑、工牌、门禁及其他办公物品"],
      ["离职交接", "工作、客户、文件、设备与账号回收"],
    ],
    nextAction: "现有员工档案与账号绑定已可复用，下一步建立可勾选的入离职清单。",
  },
  attendance: {
    title: "考勤管理",
    english: "Attendance",
    stage: "基础版",
    description: "统一请假、调休、加班、出差和外勤记录，并预留企业微信与门禁接口。",
    roles: [],
    capabilities: [
      ["请假", "现有申请、主管审批和 HR 备案已接入"],
      ["调休与加班", "后续建立加班登记与调休额度来源"],
      ["出差与外勤", "复用统一审批中心建立申请流程"],
      ["考勤接口", "未来按实际系统对接企业微信或门禁"],
    ],
    nextAction: "优先把请假审批完成事件与 HRM 假期余额自动扣减打通。",
  },
  payroll: {
    title: "薪资管理",
    english: "Payroll",
    stage: "规划中 · 高敏感",
    description: "工资、奖金、社保、公积金、个税和工资条属于独立高敏感数据域。",
    roles: ["hr", "finance", "chairman"],
    capabilities: [
      ["薪资档案", "基本工资、薪资结构与生效历史"],
      ["月度核算", "考勤、绩效、提成与奖惩汇总"],
      ["社保个税", "社保、公积金和个税数据"],
      ["工资条", "员工本人独立查看与发放记录"],
    ],
    nextAction: "正式开发前需先确认薪资核算口径、查看角色和数据加密方案。",
  },
  performance: {
    title: "绩效管理",
    english: "Performance",
    stage: "规划中",
    description: "按岗位建立目标、指标、评价周期和结果，避免直接套用不适合小团队的复杂模型。",
    roles: ["hr", "chairman", "department_lead"],
    capabilities: [
      ["指标模板", "销售、客服、仓储等岗位指标库"],
      ["目标周期", "月度或季度目标及权重"],
      ["评价过程", "员工自评、负责人评价与确认"],
      ["结果应用", "绩效结果与奖金、晋升和培训建议"],
    ],
    nextAction: "先为销售、客服和仓储分别确认 3–5 个真正使用的核心指标。",
  },
} as const;

export default async function HrModulePage({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const { module } = await params;
  const config = modules[module as keyof typeof modules];
  if (!config) notFound();

  const employee = await requireCurrentEmployee();
  const allowed =
    config.roles.length === 0 ||
    employee.roleCodes.some((role) =>
      (config.roles as readonly string[]).includes(role),
    );

  return (
    <WorkflowShell
      activeItem="人力资源"
      breadcrumb={`人力资源 / ${config.title}`}
      currentUser={{
        name: employee.name,
        roleLabel: employee.title ?? "内部员工",
      }}
    >
      <main className="mx-auto max-w-[1200px] p-4 sm:p-6 xl:p-8">
        <Link
          className="inline-flex items-center gap-2 text-[11px] text-muted-foreground hover:text-primary"
          href="/hr"
        >
          <ArrowLeft className="size-4" />
          返回 HRM 总览
        </Link>

        {!allowed ? (
          <section className="mt-5 rounded-[22px] border border-[#ead8d8] bg-white p-12 text-center">
            <LockKeyhole className="mx-auto size-9 text-[#965151]" />
            <h1 className="mt-4 text-lg font-semibold">暂无模块访问权限</h1>
            <p className="mt-2 text-xs text-muted-foreground">
              {config.title}包含人事敏感信息，仅向指定角色开放。
            </p>
          </section>
        ) : (
          <>
            <section className="mt-5 rounded-[24px] bg-[#0a385d] px-6 py-8 text-white sm:px-8">
              <div className="text-[10px] tracking-[0.15em] text-[#79d8d5]">
                HRM · {config.english.toUpperCase()}
              </div>
              <div className="mt-3 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                  <h1 className="text-2xl font-semibold">{config.title}</h1>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-white/55">
                    {config.description}
                  </p>
                </div>
                <span className="self-start rounded-full bg-white/10 px-3 py-2 text-[10px] sm:self-auto">
                  {config.stage}
                </span>
              </div>
            </section>

            <section className="mt-5 grid gap-4 sm:grid-cols-2">
              {config.capabilities.map(([title, description], index) => (
                <article
                  className="rounded-[20px] border border-border/75 bg-white p-5"
                  key={title}
                >
                  <div className="flex items-start gap-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-[#eaf3f8] text-[10px] font-semibold text-primary">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <h2 className="text-sm font-semibold">{title}</h2>
                      <p className="mt-2 text-[10px] leading-5 text-muted-foreground">
                        {description}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </section>

            <section className="mt-5 rounded-[20px] border border-border/75 bg-[#eef4f8] p-5 sm:p-6">
              <div className="flex items-start gap-3">
                {config.stage.includes("规划") ? (
                  <CircleDashed className="mt-0.5 size-5 text-primary" />
                ) : config.stage.includes("下一") ? (
                  <Clock3 className="mt-0.5 size-5 text-primary" />
                ) : (
                  <CheckCircle2 className="mt-0.5 size-5 text-primary" />
                )}
                <div>
                  <h2 className="text-sm font-semibold">当前建议</h2>
                  <p className="mt-2 text-[11px] leading-6 text-[#5c7587]">
                    {config.nextAction}
                  </p>
                  {module === "attendance" && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link
                        className="inline-flex h-9 items-center gap-1 rounded-xl bg-white px-3 text-[10px] font-medium text-primary"
                        href="/requests/leave"
                      >
                        发起请假
                        <ChevronRight className="size-3" />
                      </Link>
                      <Link
                        className="inline-flex h-9 items-center gap-1 rounded-xl bg-white px-3 text-[10px] font-medium text-primary"
                        href="/approvals"
                      >
                        审批中心
                        <ChevronRight className="size-3" />
                      </Link>
                    </div>
                  )}
                  {module === "onboarding" && (
                    <Link
                      className="mt-4 inline-flex h-9 items-center gap-1 rounded-xl bg-white px-3 text-[10px] font-medium text-primary"
                      href="/employees"
                    >
                      查看员工档案
                      <ChevronRight className="size-3" />
                    </Link>
                  )}
                </div>
              </div>
            </section>
          </>
        )}
      </main>
    </WorkflowShell>
  );
}
