export type DashboardDataSource = "live" | "demo" | "pending";

export type DashboardKpiKey =
  | "sales"
  | "orders"
  | "approvals"
  | "inventory"
  | "online";

export type DashboardKpi = {
  key: DashboardKpiKey;
  title: string;
  value: number | null;
  format: "currency" | "number";
  trend: number | null;
  trendLabel: string;
  note: string;
  source: DashboardDataSource;
  sparkline: number[];
};

export type SalesTrendPoint = {
  date: string;
  sales: number;
  orders: number;
};

export type BusinessSourceItem = {
  name: string;
  value: number;
  color: string;
};

export type BusinessSummary = {
  label: string;
  value: number;
  format: "currency" | "number" | "percent";
  trend: number | null;
  source: DashboardDataSource;
};

export type ProductRankingItem = {
  rank: number;
  name: string;
  salesAmount: number;
  share: number;
  source: DashboardDataSource;
};

export type InventoryWarningItem = {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  unit: string;
  status: "normal" | "warning" | "danger";
  statusLabel: string;
};

export type DashboardTodo = {
  id: string;
  title: string;
  applicant: string;
  time: string;
  href: string;
  kind: "leave" | "expense" | "seal" | "sales_order";
  source: DashboardDataSource;
};

export type DashboardData = {
  generatedAt: string;
  salesDataSource: DashboardDataSource;
  unreadNotificationCount: number;
  kpis: DashboardKpi[];
  salesTrend: SalesTrendPoint[];
  businessSource: BusinessSourceItem[];
  businessSummary: BusinessSummary[];
  products: ProductRankingItem[];
  inventory: InventoryWarningItem[];
  todos: DashboardTodo[];
};

export type DashboardApiResponse =
  | { ok: true; data: DashboardData }
  | { ok: false; error: string };
