import "server-only";

import { after } from "next/server";
import type { CurrentEmployee } from "@/features/auth/current-employee";
import { recordPerformance } from "@/lib/observability/performance";
import { createServerTimer } from "@/lib/observability/server-log";
import { createClient } from "@/lib/supabase/server";
import type { DashboardData, DashboardKpi, DashboardTodo, InventoryWarningItem, ProductRankingItem, SalesTrendPoint } from "@/types/dashboard";

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
  request_type: "expense" | "seal" | "sales_order";
  created_at: string;
  applicant:
    | { name: string }
    | { name: string }[]
    | null;
};

type SalesOrderRow = { id: string; order_date: string; total_cny: number; price_type: "retail" | "group" | "dropship"; status: string };
type SalesOrderItemRow = { product_name: string; line_total_cny: number };

function shanghaiDate(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(date);
}

function salesReadModel(orders: SalesOrderRow[], items: SalesOrderItemRow[]) {
  const validOrders = orders.filter((order) => order.status !== "cancelled");
  const today = shanghaiDate(new Date());
  const yesterdayDate = new Date(); yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = shanghaiDate(yesterdayDate);
  const dates = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(); date.setDate(date.getDate() - (6 - index)); return shanghaiDate(date);
  });
  const trend: SalesTrendPoint[] = dates.map((date) => {
    const rows = validOrders.filter((order) => order.order_date === date);
    return { date: date.slice(5).replace("-", "/"), sales: Number((rows.reduce((sum, row) => sum + Number(row.total_cny), 0) / 10000).toFixed(2)), orders: rows.length };
  });
  const todayRows = validOrders.filter((order) => order.order_date === today);
  const yesterdayRows = validOrders.filter((order) => order.order_date === yesterday);
  const todaySales = todayRows.reduce((sum, row) => sum + Number(row.total_cny), 0);
  const yesterdaySales = yesterdayRows.reduce((sum, row) => sum + Number(row.total_cny), 0);
  const channels = [{ key: "retail", name: "零售价订单", color: "#087D67" }, { key: "group", name: "团购价订单", color: "#4FA58C" }, { key: "dropship", name: "代发价订单", color: "#96C8B7" }];
  const totalOrders = Math.max(1, validOrders.length);
  const businessSource = channels.map((channel) => ({ name: channel.name, value: Number((validOrders.filter((order) => order.price_type === channel.key).length / totalOrders * 100).toFixed(1)), color: channel.color })).filter((item) => item.value > 0);
  const productTotals = new Map<string, number>();
  for (const item of items) productTotals.set(item.product_name, (productTotals.get(item.product_name) ?? 0) + Number(item.line_total_cny));
  const productTotal = [...productTotals.values()].reduce((sum, value) => sum + value, 0);
  const products: ProductRankingItem[] = [...productTotals.entries()].sort((left, right) => right[1] - left[1]).slice(0, 5).map(([name, salesAmount], index) => ({ rank: index + 1, name, salesAmount, share: productTotal ? Number((salesAmount / productTotal * 100).toFixed(1)) : 0, source: "live" }));
  const completed = validOrders.filter((order) => order.status === "completed").length;
  return { trend, businessSource, products, todayRows, todaySales, yesterdaySales, yesterdayOrderCount: yesterdayRows.length, validOrders, fulfillmentRate: validOrders.length ? completed / validOrders.length * 100 : 0 };
}

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
  const elapsed = createServerTimer();
  const supabase = await createClient();
  const salesFromDate = new Date();
  salesFromDate.setDate(salesFromDate.getDate() - 30);
  const [
    leaveCountResult,
    genericCountResult,
    unreadResult,
    activeEmployeesResult,
    customersResult,
    inventoryResult,
    leaveTodosResult,
    genericTodosResult,
    salesOrdersResult,
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
    supabase
      .from("sales_orders")
      .select("id, order_date, total_cny, price_type, status")
      .gte("order_date", shanghaiDate(salesFromDate))
      .order("order_date", { ascending: false })
      .limit(1000),
  ]);

  const salesOrders = (salesOrdersResult.data ?? []) as SalesOrderRow[];
  const salesOrderIds = salesOrders.filter((order) => order.status !== "cancelled").map((order) => order.id);
  const salesItemsResult = salesOrderIds.length
    ? await supabase.from("sales_order_items").select("product_name, line_total_cny").in("order_id", salesOrderIds).limit(5000)
    : { data: [], error: null };
  const salesModel = salesReadModel(salesOrders, (salesItemsResult.data ?? []) as SalesOrderItemRow[]);

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
      value: salesModel.todaySales,
      format: "currency",
      trend: salesModel.yesterdaySales > 0 ? Number(((salesModel.todaySales - salesModel.yesterdaySales) / salesModel.yesterdaySales * 100).toFixed(1)) : null,
      trendLabel: "较昨日",
      note: salesOrdersResult.error ? "销售数据暂不可用" : "非取消销售订单口径",
      source: salesOrdersResult.error ? "pending" : "live",
      sparkline: salesModel.trend.map((point) => point.sales),
    },
    {
      key: "orders",
      title: "今日订单",
      value: salesModel.todayRows.length,
      format: "number",
      trend: salesModel.yesterdayOrderCount > 0 ? Number(((salesModel.todayRows.length - salesModel.yesterdayOrderCount) / salesModel.yesterdayOrderCount * 100).toFixed(1)) : null,
      trendLabel: "较昨日",
      note: salesOrdersResult.error ? "销售数据暂不可用" : "今日非取消订单",
      source: salesOrdersResult.error ? "pending" : "live",
      sparkline: salesModel.trend.map((point) => point.orders),
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

  const dashboardData: DashboardData = {
    generatedAt: new Date().toISOString(),
    salesDataSource: salesOrdersResult.error ? "pending" : "live",
    unreadNotificationCount: unreadResult.count ?? 0,
    kpis,
    salesTrend: salesModel.trend,
    businessSource: salesModel.businessSource,
    businessSummary: [
      {
        label: "总订单数",
        value: salesModel.validOrders.length,
        format: "number",
        trend: null,
        source: salesOrdersResult.error ? "pending" : "live",
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
        value: Number(salesModel.fulfillmentRate.toFixed(1)),
        format: "percent",
        trend: null,
        source: salesOrdersResult.error ? "pending" : "live",
      },
      {
        label: "客单价",
        value: salesModel.validOrders.length ? salesModel.validOrders.reduce((sum, order) => sum + Number(order.total_cny), 0) / salesModel.validOrders.length : 0,
        format: "currency",
        trend: null,
        source: salesOrdersResult.error ? "pending" : "live",
      },
    ],
    products: salesModel.products,
    inventory: inventoryItems.slice(0, 4),
    todos: buildTodos(
      (leaveTodosResult.data ?? []) as LeaveTodoRow[],
      (genericTodosResult.data ?? []) as GenericTodoRow[],
    ),
  };

  after(async () => {
    await recordPerformance(supabase, {
      route: "/dashboard",
      operation: "load_dashboard",
      durationMs: elapsed(),
      status: "ok",
      metadata: { queryCount: 10 },
    });
  });
  return dashboardData;
}
