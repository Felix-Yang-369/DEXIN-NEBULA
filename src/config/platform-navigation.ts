import type { SidebarIconName } from "@/components/icons/sidebar-icons";

export type PlatformNavigationChild = {
  label: string;
  href: string;
  activeMatch?: string;
};

export type PlatformNavigationItem = {
  label: string;
  icon: SidebarIconName;
  href: string;
  activeItems?: string[];
  badge?: string;
  countBadge?: number;
  future?: boolean;
  children?: PlatformNavigationChild[];
};

export type PlatformNavigationGroup = {
  label: string;
  english?: string;
  items: PlatformNavigationItem[];
};

export const platformNavigationGroups: PlatformNavigationGroup[] = [
  {
    label: "经营总览",
    english: "OVERVIEW",
    items: [
      { label: "驾驶舱", icon: "dashboard", href: "/dashboard" },
    ],
  },
  {
    label: "业务管理",
    english: "BUSINESS",
    items: [
      {
        label: "客户管理",
        icon: "customers",
        href: "/customers",
        children: [
          { label: "CRM 总览", href: "/customers", activeMatch: "客户管理中心" },
          { label: "客户档案", href: "/customers", activeMatch: "客户详情" },
          { label: "报价中心", href: "/quotes", activeMatch: "报价" },
        ],
      },
      {
        label: "销售管理",
        icon: "sales",
        href: "/sales",
        activeItems: ["销售管理"],
        children: [
          { label: "销售机会", href: "/sales#opportunities", activeMatch: "销售业务" },
          { label: "销售订单", href: "/sales#orders", activeMatch: "销售订单" },
        ],
      },
      {
        label: "订单管理",
        icon: "orders",
        href: "/sales#orders",
      },
      {
        label: "供应链管理",
        icon: "supply",
        href: "/purchasing",
        activeItems: ["供应商管理", "采购管理", "仓储管理"],
        children: [
          { label: "供应商 SRM", href: "/suppliers", activeMatch: "供应商" },
          { label: "采购管理", href: "/purchasing", activeMatch: "采购" },
          { label: "仓储库存 WMS", href: "/inventory", activeMatch: "仓储库存" },
          { label: "仓储作业", href: "/inventory/operations", activeMatch: "仓储作业" },
        ],
      },
      {
        label: "产品管理",
        icon: "products",
        href: "/products",
        activeItems: ["产品中心"],
      },
    ],
  },
  {
    label: "运营管理",
    english: "OPERATIONS",
    items: [
      {
        label: "新媒体管理",
        icon: "media",
        href: "/operations/media",
        badge: "NEW",
        children: [
          { label: "账号管理", href: "/operations/media#accounts", activeMatch: "账号管理" },
          { label: "内容管理", href: "/operations/media#content", activeMatch: "内容管理" },
          { label: "发布计划", href: "/operations/media#calendar", activeMatch: "发布计划" },
          { label: "数据分析", href: "/operations/media#analytics", activeMatch: "新媒体数据" },
          { label: "舆情监控", href: "/operations/media#sentiment", activeMatch: "舆情监控" },
        ],
      },
      { label: "企业宣传", icon: "publicity", href: "/operations/publicity" },
      { label: "企业活动", icon: "events", href: "/operations/events" },
    ],
  },
  {
    label: "财务管理",
    english: "FINANCE",
    items: [
      {
        label: "财务管理",
        icon: "finance",
        href: "/finance",
        activeItems: ["银行流水"],
        children: [
          { label: "财务总览", href: "/finance", activeMatch: "财务中心" },
          { label: "应收", href: "/finance/receivables", activeMatch: "应收账款" },
          { label: "应付", href: "/finance?book=payable#documents", activeMatch: "应付" },
          { label: "利润分析", href: "/bi", activeMatch: "利润" },
          { label: "财务报表", href: "/finance/receivables", activeMatch: "财务报表" },
          { label: "银行流水与核销", href: "/finance/bank-reconciliation", activeMatch: "银行流水" },
          { label: "发票管理", href: "/finance/invoices", activeMatch: "发票" },
        ],
      },
    ],
  },
  {
    label: "AI 助手",
    english: "AI & INSIGHT",
    items: [
      { label: "德小馨 AI", icon: "ai", href: "/ai" },
      { label: "BI 数据分析", icon: "bi", href: "/bi", activeItems: ["数据分析"] },
    ],
  },
  {
    label: "组织协同",
    english: "PEOPLE & OA",
    items: [
      {
        label: "人力资源",
        icon: "employees",
        href: "/hr",
        children: [
          { label: "HRM 总览", href: "/hr", activeMatch: "HRM 总览" },
          { label: "组织架构", href: "/organization", activeMatch: "组织架构" },
          { label: "员工档案", href: "/employees", activeMatch: "员工档案" },
          { label: "绩效考核", href: "/hr/performance", activeMatch: "绩效考核" },
          { label: "入职离职", href: "/hr/onboarding", activeMatch: "入职离职" },
          { label: "考勤管理", href: "/hr/attendance", activeMatch: "考勤管理" },
          { label: "请假审批", href: "/requests/leave", activeMatch: "请假" },
        ],
      },
      {
        label: "协同办公",
        icon: "office",
        href: "/oa",
        children: [
          { label: "OA 总览", href: "/oa", activeMatch: "协同办公" },
          { label: "审批中心", href: "/approvals", activeMatch: "审批" },
          { label: "公告通知", href: "/announcements", activeMatch: "公告" },
          { label: "周报管理", href: "/reports/weekly", activeMatch: "周报" },
          { label: "文件中心", href: "/documents", activeMatch: "文件" },
        ],
      },
      {
        label: "系统管理",
        icon: "system",
        href: "/system",
        children: [
          { label: "系统总览", href: "/system", activeMatch: "系统管理" },
          { label: "角色与权限", href: "/roles", activeMatch: "角色" },
          { label: "操作日志", href: "/audit", activeMatch: "审计" },
        ],
      },
    ],
  },
];

export const platformNavigation = platformNavigationGroups.flatMap(
  (group) => group.items,
);

export function isPlatformItemActive(
  item: PlatformNavigationItem,
  activeItem: string,
) {
  return item.label === activeItem || Boolean(item.activeItems?.includes(activeItem));
}
