import type { SidebarIconName } from "@/components/icons/sidebar-icons";
import { isScopedFinanceUser } from "@/lib/auth/access-scope";

export type PlatformNavigationChild = {
  label: string;
  href: string;
  activeMatch?: string;
  allowedRoles?: string[];
  allowedPermissions?: string[];
  mobilePlacement?: "primary" | "more" | "hidden";
  desktopOnly?: boolean;
  quickCreateType?: MobileQuickCreateType;
};

export type MobileQuickCreateType =
  | "leave"
  | "expense"
  | "seal"
  | "purchase"
  | "sales_order"
  | "scan";

export type PlatformNavigationItem = {
  label: string;
  icon: SidebarIconName;
  href: string;
  activeItems?: string[];
  badge?: string;
  countBadge?: number;
  future?: boolean;
  allowedRoles?: string[];
  allowedPermissions?: string[];
  financeScoped?: boolean;
  mobilePlacement?: "primary" | "more" | "hidden";
  desktopOnly?: boolean;
  quickCreateType?: MobileQuickCreateType;
  children?: PlatformNavigationChild[];
};

export type PlatformNavigationGroup = {
  label: string;
  english: string;
  placement?: "main" | "bottom";
  items: PlatformNavigationItem[];
};

const financeRoles = ["finance", "chairman"];
const adminRoles = ["admin", "chairman"];

export const platformNavigationGroups: PlatformNavigationGroup[] = [
  {
    label: "经营决策",
    english: "OVERVIEW",
    items: [
      {
        label: "驾驶舱",
        icon: "dashboard",
        href: "/dashboard",
        financeScoped: true,
        mobilePlacement: "primary",
      },
      {
        label: "数据分析",
        icon: "bi",
        href: "/bi",
        activeItems: ["数据分析"],
        financeScoped: true,
      },
    ],
  },
  {
    label: "业务管理",
    english: "BUSINESS",
    items: [
      {
        label: "客户管理",
        icon: "crm",
        href: "/customers",
        children: [
          { label: "客户", href: "/customers", activeMatch: "客户" },
        ],
      },
      {
        label: "订单管理",
        icon: "orders",
        href: "/sales#orders",
        activeItems: ["销售订单"],
        mobilePlacement: "more",
        quickCreateType: "sales_order",
        children: [
          {
            label: "销售订单",
            href: "/sales#orders",
            activeMatch: "销售订单",
          },
        ],
      },
      {
        label: "客服中心",
        icon: "ai",
        href: "/customer-service",
        activeItems: ["客服中心"],
        allowedRoles: adminRoles,
        allowedPermissions: ["customer_service.dashboard.view"],
        children: [
          { label: "客服工作台", href: "/customer-service", activeMatch: "客服中心" },
          { label: "会话中心", href: "/customer-service?tab=conversations", activeMatch: "客服中心" },
          { label: "客服线索池", href: "/customer-service?tab=leads", activeMatch: "客服中心" },
          { label: "客服知识库", href: "/customer-service?tab=knowledge", activeMatch: "客服中心" },
        ],
      },
    ],
  },
  {
    label: "供应链管理",
    english: "SUPPLY CHAIN",
    items: [
      {
        label: "采购管理",
        icon: "supply",
        href: "/purchasing",
        activeItems: ["采购管理"],
        mobilePlacement: "more",
        quickCreateType: "purchase",
        children: [
          {
            label: "采购申请",
            href: "/purchasing#requests",
            activeMatch: "采购管理",
          },
          {
            label: "采购订单",
            href: "/purchasing#orders",
            activeMatch: "采购订单",
          },
          {
            label: "到货",
            href: "/purchasing#receiving",
            activeMatch: "到货",
          },
        ],
      },
      {
        label: "供应商管理",
        icon: "suppliers",
        href: "/suppliers",
        activeItems: ["供应商管理"],
        children: [
          { label: "供应商", href: "/suppliers", activeMatch: "供应商" },
        ],
      },
      {
        label: "仓储管理",
        icon: "inventory",
        href: "/inventory",
        activeItems: ["仓储管理"],
        children: [
          { label: "库存", href: "/inventory", activeMatch: "仓储库存" },
          {
            label: "入库 / 出库 / 调拨 / 盘点",
            href: "/inventory/operations",
            activeMatch: "仓储作业",
          },
        ],
      },
      {
        label: "产品管理",
        icon: "products",
        href: "/products",
        activeItems: ["产品中心"],
        children: [
          { label: "商品档案", href: "/products", activeMatch: "PIM" },
        ],
      },
    ],
  },
  {
    label: "财务管理",
    english: "FINANCE",
    items: [
      {
        label: "财务总览",
        icon: "finance",
        href: "/finance",
        allowedRoles: financeRoles,
        financeScoped: true,
        activeItems: ["财务管理"],
      },
      {
        label: "会计核算",
        icon: "accounting",
        href: "/finance#documents",
        allowedRoles: financeRoles,
        financeScoped: true,
        children: [
          {
            label: "应收",
            href: "/finance/receivables",
            activeMatch: "应收",
          },
          {
            label: "应付",
            href: "/finance?book=payable#documents",
            activeMatch: "应付",
          },
          {
            label: "凭证",
            href: "/finance#vouchers",
            activeMatch: "凭证",
          },
        ],
      },
      {
        label: "资金管理",
        icon: "treasury",
        href: "/finance/bank-reconciliation",
        activeItems: ["银行流水"],
        allowedRoles: financeRoles,
        financeScoped: true,
        children: [
          {
            label: "银行流水与核销",
            href: "/finance/bank-reconciliation",
            activeMatch: "银行流水",
          },
          {
            label: "收款",
            href: "/finance/cash-documents?type=receipt",
            activeMatch: "收款",
          },
          {
            label: "付款",
            href: "/finance/cash-documents?type=payment",
            activeMatch: "付款",
          },
        ],
      },
      {
        label: "税务管理",
        icon: "tax",
        href: "/finance/invoices",
        allowedRoles: financeRoles,
        financeScoped: true,
        children: [
          { label: "发票", href: "/finance/invoices", activeMatch: "发票" },
        ],
      },
      {
        label: "财务报表",
        icon: "bi",
        href: "/bi",
        allowedRoles: financeRoles,
        financeScoped: true,
        children: [
          { label: "利润分析", href: "/bi", activeMatch: "利润" },
        ],
      },
    ],
  },
  {
    label: "组织运营",
    english: "OPERATION",
    items: [
      {
        label: "人力资源",
        icon: "employees",
        href: "/hr",
        children: [
          { label: "员工档案", href: "/employees", activeMatch: "员工档案" },
          { label: "组织架构", href: "/organization", activeMatch: "组织架构" },
          { label: "考勤", href: "/hr/attendance", activeMatch: "考勤" },
          { label: "请假", href: "/requests/leave", activeMatch: "请假" },
          { label: "绩效", href: "/hr/performance", activeMatch: "绩效" },
          { label: "入职离职", href: "/hr/onboarding", activeMatch: "入职离职" },
        ],
      },
      {
        label: "市场营销",
        icon: "media",
        href: "/operations/media",
        activeItems: ["新媒体管理", "企业宣传", "企业活动"],
        children: [
          { label: "内容与新媒体", href: "/operations/media", activeMatch: "新媒体" },
          { label: "企业宣传", href: "/operations/publicity", activeMatch: "企业宣传" },
          { label: "活动", href: "/operations/events", activeMatch: "企业活动" },
        ],
      },
    ],
  },
  {
    label: "协同办公",
    english: "WORKPLACE",
    items: [
      {
        label: "审批",
        icon: "approvals",
        href: "/approvals",
        financeScoped: true,
        mobilePlacement: "primary",
        children: [
          { label: "待办", href: "/approvals", activeMatch: "审批", mobilePlacement: "primary" },
          { label: "请假申请", href: "/requests/leave", activeMatch: "请假", quickCreateType: "leave" },
          { label: "费用报销", href: "/requests/expense", activeMatch: "费用报销", quickCreateType: "expense" },
          { label: "用印申请", href: "/requests/seal", activeMatch: "用印", quickCreateType: "seal" },
        ],
      },
      {
        label: "文件中心",
        icon: "documents",
        href: "/documents",
        financeScoped: true,
        children: [
          { label: "企业文件", href: "/documents", activeMatch: "文件" },
        ],
      },
      {
        label: "协同工作台",
        icon: "office",
        href: "/oa",
        activeItems: ["协同办公"],
        financeScoped: true,
        children: [
          { label: "公告", href: "/announcements", activeMatch: "公告" },
          { label: "周报", href: "/reports/weekly", activeMatch: "周报" },
          { label: "内部表单", href: "/forms", activeMatch: "内部表单" },
          { label: "制度与知识", href: "/knowledge", activeMatch: "制度与知识" },
        ],
      },
    ],
  },
  {
    label: "系统管理",
    english: "ADMIN",
    placement: "bottom",
    items: [
      {
        label: "系统管理",
        icon: "system",
        href: "/system",
        allowedRoles: adminRoles,
        desktopOnly: true,
        children: [
          {
            label: "组织与用户",
            href: "/employees",
            activeMatch: "组织与用户",
          },
          {
            label: "员工权限分配",
            href: "/roles#employee-permissions",
            activeMatch: "角色",
          },
          { label: "系统配置", href: "/system", activeMatch: "系统管理" },
          {
            label: "操作日志",
            href: "/audit",
            activeMatch: "审计",
            allowedRoles: ["admin"],
          },
        ],
      },
    ],
  },
];

export const platformNavigation = platformNavigationGroups.flatMap(
  (group) => group.items,
);

export function navigationGroupsForRoles(
  roleCodes: string[],
  permissionCodes: string[] = [],
) {
  const financeScoped = isScopedFinanceUser(roleCodes);

  return platformNavigationGroups
    .map((group) => ({
      ...group,
      items: group.items
        .filter((item) => !financeScoped || item.financeScoped)
        .filter((item) => {
          const roleAllowed = item.allowedRoles?.some((role) => roleCodes.includes(role)) ?? false;
          const permissionAllowed = item.allowedPermissions?.some((permission) => permissionCodes.includes(permission)) ?? false;
          return (!item.allowedRoles?.length && !item.allowedPermissions?.length) || roleAllowed || permissionAllowed;
        })
        .map((item) => ({
          ...item,
          children: item.children?.filter((child) => {
            const roleAllowed = child.allowedRoles?.some((role) => roleCodes.includes(role)) ?? false;
            const permissionAllowed = child.allowedPermissions?.some((permission) => permissionCodes.includes(permission)) ?? false;
            return (!child.allowedRoles?.length && !child.allowedPermissions?.length) || roleAllowed || permissionAllowed;
          }),
        })),
    }))
    .filter((group) => group.items.length > 0);
}

export function splitNavigationGroups(groups: PlatformNavigationGroup[]) {
  return {
    mainGroups: groups.filter((group) => group.placement !== "bottom"),
    bottomGroups: groups.filter((group) => group.placement === "bottom"),
  };
}

export function isPlatformItemActive(
  item: PlatformNavigationItem,
  activeItem: string,
) {
  return (
    item.label === activeItem || Boolean(item.activeItems?.includes(activeItem))
  );
}
