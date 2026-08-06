import type { Metadata } from "next";
import Link from "next/link";
import {
  BookOpenText,
  CheckCircle2,
  CircleHelp,
  ClipboardCheck,
  FileArchive,
  Megaphone,
  NotebookPen,
  Search,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { WorkflowShell } from "@/features/approvals/workflow-shell";
import { requireCurrentEmployee } from "@/features/auth/current-employee";

export const metadata: Metadata = {
  title: "使用指南",
  description: "德馨星云常用功能、流程和数据安全使用指南",
};

const guideCards = [
  {
    icon: Search,
    title: "全局搜索",
    description:
      "在顶部搜索员工、制度、产品、客户和公告；结果自动遵循你的数据权限。",
    href: "/search",
    action: "开始搜索",
  },
  {
    icon: ClipboardCheck,
    title: "申请与审批",
    description:
      "请假和报销从工作台快捷入口发起，审批进度和历史统一在审批中心查看。",
    href: "/approvals",
    action: "打开审批中心",
  },
  {
    icon: NotebookPen,
    title: "提交周报",
    description:
      "按周填写完成工作、推进事项、存在问题和下周计划；提交后直属负责人可见。",
    href: "/reports/weekly",
    action: "填写周报",
  },
  {
    icon: Megaphone,
    title: "公告通知",
    description:
      "查看全员或本部门公告；打开公告详情后，系统会记录当前账号已经阅读。",
    href: "/announcements",
    action: "查看公告",
  },
  {
    icon: BookOpenText,
    title: "制度中心",
    description:
      "按分类或关键词查找员工行为、行政、考勤、周报与企业文化等内部制度。",
    href: "/knowledge",
    action: "查询制度",
  },
  {
    icon: UsersRound,
    title: "组织与员工",
    description:
      "查看组织关系和员工信息；人事与管理员可以维护档案、负责人和账号状态。",
    href: "/organization",
    action: "打开通讯录",
  },
  {
    icon: FileArchive,
    title: "文件中心",
    description:
      "按权限上传和查找合同、客户文件、供应商资质及内部资料，下载与归档均保留审计记录。",
    href: "/documents",
    action: "打开文件中心",
  },
];

export default async function HelpPage() {
  const employee = await requireCurrentEmployee();

  return (
    <WorkflowShell
      activeItem=""
      breadcrumb="帮助 / 使用指南"
      currentUser={{
        name: employee.name,
        roleLabel: employee.title ?? "内部员工",
      }}
    >
      <main className="mx-auto max-w-[1380px] p-4 sm:p-6 xl:p-8">
        <section className="relative overflow-hidden rounded-[24px] bg-[#0a385d] px-6 py-8 text-white sm:px-9">
          <CircleHelp className="pointer-events-none absolute right-12 top-1/2 hidden size-40 -translate-y-1/2 text-white/[0.055] sm:block" />
          <div className="relative max-w-3xl">
            <div className="text-[10px] font-medium tracking-[0.14em] text-[#79d8d5]">
              DEXIN NEBULA GUIDE
            </div>
            <h1 className="mt-3 text-2xl font-semibold">德馨星云使用指南</h1>
            <p className="mt-3 text-sm leading-7 text-white/55">
              从日常办公入口开始，快速了解搜索、审批、周报、公告、制度与权限规则。
            </p>
          </div>
        </section>

        <section className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {guideCards.map((card) => {
            const Icon = card.icon;
            return (
              <article
                className="flex min-h-56 flex-col rounded-[22px] border border-border/80 bg-white p-6 shadow-[0_10px_35px_-28px_rgba(23,57,50,.32)]"
                key={card.title}
              >
                <span className="grid size-10 place-items-center rounded-xl bg-[#eef4f8] text-primary">
                  <Icon className="size-[18px]" />
                </span>
                <h2 className="mt-5 text-base font-semibold text-[#294b65]">
                  {card.title}
                </h2>
                <p className="mt-2 text-[11px] leading-6 text-muted-foreground">
                  {card.description}
                </p>
                <Link
                  className="mt-auto pt-5 text-[10px] font-medium text-primary"
                  href={card.href}
                >
                  {card.action}　→
                </Link>
              </article>
            );
          })}
        </section>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <section className="rounded-[22px] border border-border/80 bg-white p-6">
            <div className="flex items-center gap-3">
              <ShieldCheck className="size-5 text-primary" />
              <h2 className="text-sm font-semibold text-[#294b65]">
                权限与数据安全
              </h2>
            </div>
            <ul className="mt-5 space-y-3 text-[11px] leading-6 text-muted-foreground">
              <li>● 页面菜单是否显示，不代表可以绕过服务端或数据库权限。</li>
              <li>● 客户价格、采购价、员工档案和财务数据按角色限制。</li>
              <li>● 不通过截图、导出或转发扩大内部数据使用范围。</li>
              <li>● 不在公告、周报或备注中填写密码、银行卡等敏感信息。</li>
            </ul>
            <Link
              className="mt-5 inline-flex h-9 items-center rounded-xl bg-[#eef4f8] px-4 text-[10px] font-medium text-primary"
              href="/roles"
            >
              查看角色权限矩阵
            </Link>
          </section>

          <section className="rounded-[22px] border border-[#d9e8ee] bg-[#eef4f8] p-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="size-5 text-primary" />
              <h2 className="text-sm font-semibold text-[#294b65]">
                遇到问题怎么办
              </h2>
            </div>
            <ol className="mt-5 space-y-3 text-[11px] leading-6 text-[#5c7587]">
              <li>1. 先刷新页面，确认网络和企业邮箱账号登录状态。</li>
              <li>2. 查看页面是否提示缺少负责人、角色或数据库迁移。</li>
              <li>3. 业务数据有误时联系对应部门负责人核实。</li>
              <li>4. 登录、权限或系统错误联系系统管理员处理。</li>
            </ol>
          </section>
        </div>
      </main>
    </WorkflowShell>
  );
}
