import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PlatformModulePage } from "@/components/business/platform-module-page";
import { requireCurrentEmployee } from "@/features/auth/current-employee";

type OperationsModule = "media" | "publicity" | "events";

const modules = {
  media: {
    activeItem: "市场营销",
    breadcrumb: "组织运营 / 市场营销 / 内容与新媒体",
    eyebrow: "OPERATIONS · NEW MEDIA MANAGEMENT",
    title: "新媒体管理",
    description:
      "统一管理企业新媒体账号、选题内容、发布节奏与经营反馈，为德馨淼盛、德馨红醴等品牌建立可追踪的内容运营工作流。",
    stage: "V0.10 规划入口",
    capabilities: [
      { id: "accounts", title: "账号管理", description: "集中登记抖音、视频号、小红书与公众号等品牌账号、负责人和授权状态。" },
      { id: "content", title: "内容管理", description: "沉淀选题、脚本、素材、成片和审核版本，减少素材散落与重复制作。" },
      { id: "calendar", title: "发布计划", description: "按品牌、平台和负责人编排内容日历，跟踪待制作、待审核、待发布和已发布状态。" },
      { id: "analytics", title: "数据分析", description: "统一观察曝光、播放、互动、线索和转化数据；接入平台接口前不展示虚构统计。" },
      { id: "sentiment", title: "舆情监控", description: "规划品牌关键词、评论风险和异常声量提醒，重要事项可联动 OA 消息与处理人。" },
    ],
    relatedLinks: [
      { label: "企业宣传", href: "/operations/publicity" },
      { label: "企业活动", href: "/operations/events" },
      { label: "文件中心", href: "/documents" },
    ],
  },
  publicity: {
    activeItem: "市场营销",
    breadcrumb: "组织运营 / 市场营销 / 企业宣传",
    eyebrow: "OPERATIONS · CORPORATE COMMUNICATIONS",
    title: "企业宣传",
    description:
      "统一管理公司介绍、品牌口径、新闻稿、宣传册和对外素材，确保不同渠道使用一致、有效且经过审核的企业信息。",
    stage: "V0.10 规划入口",
    capabilities: [
      { title: "品牌资料库", description: "归档 Logo、企业介绍、核心业务、品牌规范和标准对外文案。" },
      { title: "新闻与稿件", description: "管理新闻选题、撰写、审核、发布渠道与最终版本。" },
      { title: "宣传物料", description: "连接产品手册、公司画册、海报、视频与可下载文件。" },
      { title: "发布审核", description: "重要对外内容进入负责人审批，保留版本与操作记录。" },
    ],
    relatedLinks: [
      { label: "新媒体管理", href: "/operations/media" },
      { label: "文件中心", href: "/documents" },
      { label: "公告通知", href: "/announcements" },
    ],
  },
  events: {
    activeItem: "市场营销",
    breadcrumb: "组织运营 / 市场营销 / 活动",
    eyebrow: "OPERATIONS · CORPORATE EVENTS",
    title: "企业活动",
    description:
      "围绕展会、客户活动、员工活动和品牌发布建立计划、预算、物料、人员与复盘的统一协作入口。",
    stage: "V0.10 规划入口",
    capabilities: [
      { title: "活动立项", description: "明确活动目标、时间、地点、负责人、参与对象与预期成果。" },
      { title: "预算与审批", description: "关联采购、报销和统一审批流程，形成完整费用链路。" },
      { title: "执行清单", description: "跟踪场地、人员、物料、邀约、签到和现场执行事项。" },
      { title: "活动复盘", description: "沉淀参与、线索、传播、费用和结果，形成可复用活动经验。" },
    ],
    relatedLinks: [
      { label: "新媒体管理", href: "/operations/media" },
      { label: "采购管理", href: "/purchasing" },
      { label: "审批中心", href: "/approvals" },
    ],
  },
} satisfies Record<
  OperationsModule,
  {
    activeItem: string;
    breadcrumb: string;
    eyebrow: string;
    title: string;
    description: string;
    stage: string;
    capabilities: Array<{ id?: string; title: string; description: string }>;
    relatedLinks: Array<{ label: string; href: string }>;
  }
>;

export const metadata: Metadata = {
  title: "运营管理",
  description: "德馨星云新媒体、企业宣传与企业活动管理入口",
};

export function generateStaticParams() {
  return Object.keys(modules).map((module) => ({ module }));
}

export default async function OperationsModulePage({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const { module } = await params;
  const config = modules[module as OperationsModule];
  if (!config) notFound();

  const employee = await requireCurrentEmployee();
  return <PlatformModulePage employee={employee} {...config} />;
}
