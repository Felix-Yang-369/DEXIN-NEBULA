import "server-only";

import type { CurrentEmployee } from "@/features/auth/current-employee";
import { createClient } from "@/lib/supabase/server";
import type {
  BusinessSourceItem,
  DashboardData,
  DashboardKpi,
  DashboardTodo,
  InventoryWarningItem,
  ProductRankingItem,
  SalesTrendPoint,
} from "@/types/dashboard";

type InventoryRow = {
  id: string;
  sku: string;
  product_name: string;
  available_quantity: number;
  quarantined_quantity: number;
  safety_stock: number;
  unit: string;
};

type LeaveTodoRow = {
  id: string;
  leave_type: string;
  created_at: string;
  applicant:
    | { name: string }
    | { name: string }[]
    | null;
};

type GenericTodoRow = {
  id: string;
  title: string;
  request_type: "expense" | "seal";
  created_at: string;
  applicant:
    | { name: string }
    | { name: string }[]
    | null;
};

const DEMO_SALES_TREND: SalesTrendPoint[] = [
  { date: "07/23", sales: 40, orders: 80 },
  { date: "07/24", sales: 65, orders: 120 },
  { date: "07/25", sales: 58, orders: 110 },
  { date: "07/26", sales: 72, orders: 150 },
  { date: "07/27", sales: 90, orders: 180 },
  { date: "07/28", sales: 68, orders: 130 },
];

const DEMO_BUSINESS_SOURCE: BusinessSourceItem[] = [
  { name: "客户下单", value: 45.2, color: "#087D67" },
  { name: "销售下单", value: 28.7, color: "#4FA58C" },
  { name: "线上商城", value: 15.6, color: "#96C8B7" },
  { name: "其他渠道", value: 10.5, color: "#C9DDD5" },
];

const DEMO_PRODUCT_RANKING: ProductRankingItem[] = [
  {
    rank: 1,
    name: "德馨礼盒",
    salesAmount: 1126840,
    share: 26.3,
    source: "demo",
  },
  {
    rank: 2,
    name: "金龙鱼香米",
    salesAmount: 805690,
    share: 18.8,
    source: "demo",
  },
  {
    rank: 3,
    name: "福临门大豆油",
    salesAmount: 655700,
    share: 15.3,
    source: "demo",
  },
  {
    rank: 4,
    name: "德馨经典礼盒",
    salesAmount: 557130,
    share: 13,
    source: "demo",
  },
  {
    rank: 5,
    name: "胡姬花花生油",
    salesAmount: 411420,
    share: 9.6,
    source: "demo",
  },
];

const LEAVE_TYPE_LABELS: Record<string, string> = {
  welfare: "福利假",
  sick: "病假",
  personal: "事假",
  marriage: "婚假",
  bereavement: "丧假",
  maternity: "产假",
  paternity: "陪产假",
  work_injury: "工伤假",
  other: "其他请假",
};

function relationOne<T>(value: T | T[] | null) {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function inventoryStatus(row: InventoryRow): InventoryWarningItem["status"] {
  const available = Number(row.available_quantity);
  if (Number(row.quarantined_quantity) > 0 || available <= 50) {
    return "danger";
  }
  if (
    (Number(row.safety_stock) > 0 && available <= Number(row.safety_stock)) ||
    available <= 100
  ) {
    return "warning";
  }
  return "normal";
}

function buildInventoryWarnings(rows: InventoryRow[]) {
  const labels: Record<InventoryWarningItem["status"], string> = {
    normal: "库存正常",
    warning: "低于安全库存",
    danger: "严重不足",
  };
  const items = rows.map((row) => {
    const status = inventoryStatus(row);
    return {
      id: row.id,
      name: row.product_name,
      sku: row.sku,
      quantity: Number(row.available_quantity),
      unit: row.unit,
      status,
      statusLabel: labels[status],
    } satisfies InventoryWarningItem;
  });

  const priority: Record<InventoryWarningItem["status"], number> = {
    danger: 0,
    warning: 1,
    normal: 2,
  };
  return items.sort(
    (left, right) =>
      priority[left.status] - priority[right.status] ||
      left.quantity - right.quantity,
  );
}

function buildTodos(
  leaveRows: LeaveTodoRow[],
  genericRows: GenericTodoRow[],
) {
  const leaveTodos = leaveRows.map((row) => ({
    id: `leave-${row.id}`,
    title: `审批：${LEAVE_TYPE_LABELS[row.leave_type] ?? "请假申请"}`,
    applicant: relationOne(row.applicant)?.name ?? "内部员工",
    time: row.created_at,
    href: "/approvals",
    kind: "leave" as const,
    source: "live" as const,
  }));
  const genericTodos = genericRows.map((row) => ({
    id: `approval-${row.id}`,
    title: `审批：${row.title}`,
    applicant: relationOne(row.applicant)?.name ?? "内部员工",
    time: row.created_at,
    href: "/approvals",
    kind: row.request_type,
    source: "live" as const,
  }));
  return [...leaveTodos, ...genericTodos]
    .sort(
      (left, right) =>
        new Date(right.time).getTime() - new Date(left.time).getTime(),
    )
    .slice(0, 4) satisfies DashboardTodo[];
}

export async function getDashboardData(
  employee: CurrentEmployee,
): Promise<DashboardData> {
  const supabase = await createClient();
  const [
    leaveCountResult,
    genericCountResult,
    unreadResult,
    activeEmployeesResult,
    customersResult,
    inventoryResult,
    leaveTodosResult,
    genericTodosResult,
  ] = await Promise.all([
    supabase
      .from("leave_requests")
      .select("id", { count: "exact", head: true })
      .eq("current_approver_employee_id", employee.id)
      .in("status", [
        "pending_department",
        "pending_chairman",
        "pending_hr_filing",
      ]),
    supabase
      .from("approval_requests")
      .select("id", { count: "exact", head: true })
      .eq("current_approver_employee_id", employee.id)
      .eq("status", "pending"),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .is("read_at", null),
    supabase
      .from("employees")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
    supabase
      .from("customers")
      .select("id", { count: "exact", head: true }),
    supabase
      .from("inventory_items")
      .select(
        "id, sku, product_name, available_quantity, quarantined_quantity, safety_stock, unit",
      )
      .eq("status", "active")
      .limit(1000),
    supabase
      .from("leave_requests")
      .select(
        "id, leave_type, created_at, applicant:employees!leave_requests_applicant_employee_id_fkey(name)",
      )
      .eq("current_approver_employee_id", employee.id)
      .in("status", [
        "pending_department",
        "pending_chairman",
        "pending_hr_filing",
      ])
      .order("created_at", { ascending: false })
      .limit(4),
    supabase
      .from("approval_requests")
      .select(
        "id, title, request_type, created_at, applicant:employees!approval_requests_applicant_employee_id_fkey(name)",
      )
      .eq("current_approver_employee_id", employee.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(4),
  ]);

  const pendingCount =
    (leaveCountResult.count ?? 0) + (genericCountResult.count ?? 0);
  const inventoryRows = (inventoryResult.data ?? []) as InventoryRow[];
  const inventoryItems = buildInventoryWarnings(inventoryRows);
  const inventoryWarningCount = inventoryItems.filter(
    (item) => item.status !== "normal",
  ).length;
  const activeEmployeeCount = activeEmployeesResult.count ?? 0;

  const kpis: DashboardKpi[] = [
    {
      key: "sales",
      title: "今日销售额",
      value: 286560,
      format: "currency",
      trend: 14.8,
      trendLabel: "较昨日",
      note: "销售订单模块演示口径",
      source: "demo",
      sparkline: [42, 55, 48, 66, 52, 71, 64, 82],
    },
    {
      key: "orders",
      title: "今日订单",
      value: 128,
      format: "number",
      trend: 9.6,
      trendLabel: "较昨日",
      note: "销售订单模块演示口径",
      source: "demo",
      sparkline: [32, 36, 41, 39, 48, 52, 58, 63],
    },
    {
      key: "approvals",
      title: "待审批事项",
      value: pendingCount,
      format: "number",
      trend: null,
      trendLabel: "实时",
      note: "当前账号真实审批待办",
      source: "live",
      sparkline: [3, 4, 3, 5, 4, 4, 2, pendingCount],
    },
    {
      key: "inventory",
      title: "库存预警",
      value: inventoryWarningCount,
      format: "number",
      trend: null,
      trendLabel: "实时",
      note: inventoryResult.error
        ? "库存数据暂不可用"
        : "低库存、隔离及零库存商品",
      source: inventoryResult.error ? "pending" : "live",
      sparkline: [10, 9, 11, 10, 9, 8, 8, inventoryWarningCount],
    },
    {
      key: "online",
      title: "在职员工",
      value: activeEmployeeCount,
      format: "number",
      trend: null,
      trendLabel: "实时",
      note: "在线状态接入前展示在职人数",
      source: activeEmployeesResult.error ? "pending" : "live",
      sparkline: [10, 10, 11, 11, 11, 12, 12, activeEmployeeCount],
    },
  ];

  return {
    generatedAt: new Date().toISOString(),
    salesDataSource: "demo",
    unreadNotificationCount: unreadResult.count ?? 0,
    kpis,
    salesTrend: DEMO_SALES_TREND,
    businessSource: DEMO_BUSINESS_SOURCE,
    businessSummary: [
      {
        label: "总订单数",
        value: 1248,
        format: "number",
        trend: 18.3,
        source: "demo",
      },
      {
        label: "客户数",
        value: customersResult.count ?? 0,
        format: "number",
        trend: null,
        source: customersResult.error ? "pending" : "live",
      },
      {
        label: "履约率",
        value: 92.8,
        format: "percent",
        trend: 5.6,
        source: "demo",
      },
      {
        label: "客单价",
        value: 1256,
        format: "currency",
        trend: 6.4,
        source: "demo",
      },
    ],
    products: DEMO_PRODUCT_RANKING,
    inventory: inventoryItems.slice(0, 4),
    todos: buildTodos(
      (leaveTodosResult.data ?? []) as LeaveTodoRow[],
      (genericTodosResult.data ?? []) as GenericTodoRow[],
    ),
  };
}
