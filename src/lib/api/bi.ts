import "server-only";

import type { CurrentEmployee } from "@/features/auth/current-employee";
import { createClient } from "@/lib/supabase/server";
import type {
  BiData,
  BiKpi,
  BiPeriod,
  DataCoverageItem,
  NamedValue,
  ReceivableRanking,
} from "@/types/bi";

type CustomerRow = { id: string; level: "S" | "A" | "B" | "C"; status: string };
type FinanceRow = {
  id: string;
  document_type: "receivable" | "payable";
  counterparty_name: string;
  issue_date: string;
  due_date: string;
  total_amount: number | string;
  settled_amount: number | string;
  status: "open" | "partial" | "settled" | "void";
};
type InventoryRow = {
  category: "rice" | "oil" | "gift" | "other" | "unknown";
  available_quantity: number | string;
  quarantined_quantity: number | string;
  safety_stock: number | string;
  status: string;
};
type EmployeeRow = {
  id: string;
  status: string;
  departments: { name: string } | { name: string }[] | null;
};
type OrderRow = {
  id: string;
  status: "draft" | "confirmed" | "fulfilling" | "completed" | "cancelled";
  total_cny: number | string;
  order_date: string;
};

const CATEGORY_LABELS: Record<InventoryRow["category"], string> = {
  rice: "大米",
  oil: "食用油",
  gift: "礼盒",
  other: "调味杂粮",
  unknown: "未分类",
};
const ORDER_LABELS: Record<OrderRow["status"], string> = {
  draft: "草稿",
  confirmed: "已确认",
  fulfilling: "履约中",
  completed: "已完成",
  cancelled: "已取消",
};

function relationOne<T>(value: T | T[] | null) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function periodStart(period: BiPeriod) {
  if (period === "all") return null;
  const date = new Date();
  date.setMonth(date.getMonth() - Number.parseInt(period, 10));
  return date.toISOString().slice(0, 10);
}

function coverage(
  label: string,
  records: number,
  error: unknown,
  readyNote: string,
): DataCoverageItem {
  if (error) {
    return {
      label,
      records: 0,
      status: "restricted",
      note: "当前账号无数据权限或来源暂不可用",
    };
  }
  return {
    label,
    records,
    status: records > 0 ? "ready" : "empty",
    note: records > 0 ? readyNote : "尚无正式业务记录",
  };
}

export async function getBiData(
  _employee: CurrentEmployee,
  period: BiPeriod,
): Promise<BiData> {
  const supabase = await createClient();
  const start = periodStart(period);
  let financeQuery = supabase
    .from("finance_documents")
    .select(
      "id, document_type, counterparty_name, issue_date, due_date, total_amount, settled_amount, status",
    )
    .neq("status", "void")
    .limit(3000);
  let orderQuery = supabase
    .from("sales_orders")
    .select("id, status, total_cny, order_date")
    .limit(3000);
  if (start) {
    financeQuery = financeQuery.gte("issue_date", start);
    orderQuery = orderQuery.gte("order_date", start);
  }

  const [
    customerResult,
    financeResult,
    inventoryResult,
    employeeResult,
    orderResult,
    productCountResult,
    supplierCountResult,
  ] = await Promise.all([
    supabase
      .from("customers")
      .select("id, level, status")
      .neq("status", "inactive")
      .limit(3000),
    financeQuery,
    supabase
      .from("inventory_items")
      .select(
        "category, available_quantity, quarantined_quantity, safety_stock, status",
      )
      .eq("status", "active")
      .limit(3000),
    supabase
      .from("employees")
      .select("id, status, departments(name)")
      .eq("status", "active")
      .limit(1000),
    orderQuery,
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
    supabase
      .from("suppliers")
      .select("id", { count: "exact", head: true }),
  ]);

  const customers = (customerResult.data ?? []) as CustomerRow[];
  const finance = (financeResult.data ?? []) as FinanceRow[];
  const inventory = (inventoryResult.data ?? []) as InventoryRow[];
  const employees = (employeeResult.data ?? []) as EmployeeRow[];
  const orders = (orderResult.data ?? []) as OrderRow[];
  const receivables = finance.filter(
    (item) => item.document_type === "receivable",
  );
  const receivableOutstanding = receivables.reduce(
    (total, item) =>
      total + Math.max(0, Number(item.total_amount) - Number(item.settled_amount)),
    0,
  );
  const completedRevenue = orders
    .filter((item) => item.status === "completed")
    .reduce((total, item) => total + Number(item.total_cny), 0);
  const inventoryWarnings = inventory.filter(
    (item) =>
      Number(item.quarantined_quantity) > 0 ||
      Number(item.available_quantity) <=
        Math.max(Number(item.safety_stock), 100),
  );

  const kpis: BiKpi[] = [
    {
      key: "customers",
      label: "活跃客户",
      value: customers.length,
      format: "number",
      note: "当前权限范围内客户主档",
      sourceAvailable: !customerResult.error,
    },
    {
      key: "receivables",
      label: "应收余额",
      value: receivableOutstanding,
      format: "currency",
      note: "应收原值减已核销金额",
      sourceAvailable: !financeResult.error,
    },
    {
      key: "orders",
      label: "已履约收入",
      value: completedRevenue,
      format: "currency",
      note: "已完成销售订单含税金额",
      sourceAvailable: !orderResult.error,
    },
    {
      key: "inventory",
      label: "在库 SKU",
      value: inventory.length,
      format: "number",
      note: "启用状态库存商品数",
      sourceAvailable: !inventoryResult.error,
    },
    {
      key: "warnings",
      label: "库存风险 SKU",
      value: inventoryWarnings.length,
      format: "number",
      note: "低库存、隔离或零库存",
      sourceAvailable: !inventoryResult.error,
    },
    {
      key: "employees",
      label: "在职员工",
      value: employees.length,
      format: "number",
      note: "当前在职组织规模",
      sourceAvailable: !employeeResult.error,
    },
  ];

  const customerLevels: NamedValue[] = ["S", "A", "B", "C"].map((name) => ({
    name: `${name}级客户`,
    value: customers.filter((item) => item.level === name).length,
  }));

  const today = new Date();
  const agingTotals = new Map([
    ["未到期", 0],
    ["逾期 1–30 天", 0],
    ["逾期 31–60 天", 0],
    ["逾期 61–90 天", 0],
    ["逾期 90 天以上", 0],
  ]);
  for (const item of receivables) {
    const outstanding = Math.max(
      0,
      Number(item.total_amount) - Number(item.settled_amount),
    );
    if (outstanding === 0) continue;
    const days = Math.floor(
      (today.getTime() - new Date(`${item.due_date}T00:00:00+08:00`).getTime()) /
        86_400_000,
    );
    const bucket =
      days <= 0
        ? "未到期"
        : days <= 30
          ? "逾期 1–30 天"
          : days <= 60
            ? "逾期 31–60 天"
            : days <= 90
              ? "逾期 61–90 天"
              : "逾期 90 天以上";
    agingTotals.set(bucket, (agingTotals.get(bucket) ?? 0) + outstanding);
  }
  const receivableAging = [...agingTotals].map(([name, value]) => ({
    name,
    value,
  }));

  const rankingMap = new Map<string, ReceivableRanking>();
  for (const item of receivables) {
    const outstanding = Math.max(
      0,
      Number(item.total_amount) - Number(item.settled_amount),
    );
    if (outstanding === 0) continue;
    const current = rankingMap.get(item.counterparty_name) ?? {
      name: item.counterparty_name,
      outstanding: 0,
      documentCount: 0,
    };
    current.outstanding += outstanding;
    current.documentCount += 1;
    rankingMap.set(item.counterparty_name, current);
  }
  const receivableRanking = [...rankingMap.values()]
    .sort((left, right) => right.outstanding - left.outstanding)
    .slice(0, 6);

  const inventoryCategories = Object.entries(CATEGORY_LABELS).map(
    ([category, name]) => {
      const rows = inventory.filter((item) => item.category === category);
      return {
        name,
        value: rows.length,
        secondary: rows.filter((item) => inventoryWarnings.includes(item)).length,
      };
    },
  );

  const departmentMap = new Map<string, number>();
  for (const employee of employees) {
    const name = relationOne(employee.departments)?.name ?? "未分配部门";
    departmentMap.set(name, (departmentMap.get(name) ?? 0) + 1);
  }
  const departmentHeadcount = [...departmentMap]
    .map(([name, value]) => ({ name, value }))
    .sort((left, right) => right.value - left.value);

  const orderStatuses = Object.entries(ORDER_LABELS).map(([status, name]) => {
    const rows = orders.filter((item) => item.status === status);
    return {
      name,
      value: rows.length,
      secondary: rows.reduce((total, item) => total + Number(item.total_cny), 0),
    };
  });

  const coverageItems = [
    coverage("CRM 客户", customers.length, customerResult.error, "客户分级数据可分析"),
    coverage("销售订单", orders.length, orderResult.error, "订单与履约数据可分析"),
    coverage("库存主档", inventory.length, inventoryResult.error, "库存风险数据可分析"),
    coverage("财务往来", finance.length, financeResult.error, "应收应付数据可分析"),
    coverage("组织员工", employees.length, employeeResult.error, "组织人数数据可分析"),
    coverage(
      "产品中心",
      productCountResult.count ?? 0,
      productCountResult.error,
      "产品主数据可分析",
    ),
    coverage(
      "供应商",
      supplierCountResult.count ?? 0,
      supplierCountResult.error,
      "供应商主数据可分析",
    ),
  ];

  const warnings: string[] = [];
  if (!orderResult.error && orders.length === 0) {
    warnings.push("当前期间尚无正式销售订单，因此收入与订单状态只显示真实的零值。");
  }
  if (!financeResult.error && finance.length > 0 && finance.every((item) => item.issue_date === finance[0]?.issue_date)) {
    warnings.push("现有财务往来集中在单一业务日期，暂不绘制容易误导的时间趋势线。");
  }
  if (financeResult.error) {
    warnings.push("当前账号没有财务明细权限，应收与账龄指标按权限显示为空。");
  }

  return {
    generatedAt: new Date().toISOString(),
    period,
    kpis,
    customerLevels,
    receivableAging,
    receivableRanking,
    inventoryCategories,
    departmentHeadcount,
    orderStatuses,
    coverage: coverageItems,
    warnings,
  };
}
