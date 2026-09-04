import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
  CircleAlert,
  ClipboardList,
  Clock3,
  Database,
  Download,
  FileSpreadsheet,
  MapPin,
  PackageCheck,
  PackagePlus,
  PackageX,
  Search,
  ShieldCheck,
  Warehouse,
} from "lucide-react";
import { WorkflowShell } from "@/features/approvals/workflow-shell";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import {
  createInventoryItem,
  createWarehouse,
  recordInventoryMovement,
} from "@/features/inventory/server-actions";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "仓储库存",
  description: "德馨星云仓库、SKU、库存预警与出入库管理",
};

export const dynamic = "force-dynamic";

type WarehouseRow = {
  id: string;
  code: string;
  name: string;
  address: string | null;
  warehouse_type: "owned" | "third_party" | "virtual";
  partner_name: string | null;
  status: "active" | "inactive";
};

type InventoryRow = {
  id: string;
  warehouse_id: string;
  sku: string;
  product_name: string;
  specification: string | null;
  unit: string;
  category: "rice" | "oil" | "gift" | "other" | "unknown";
  barcode: string | null;
  case_specification: string | null;
  location_code: string | null;
  quantity: number;
  available_quantity: number;
  reserved_quantity: number;
  quarantined_quantity: number;
  safety_stock: number;
  product_id: string | null;
  last_imported_at: string | null;
  status: "active" | "inactive";
  warehouses: { name: string; code: string } | { name: string; code: string }[] | null;
};

type MovementRow = {
  id: string;
  movement_no: string;
  movement_type:
    | "inbound"
    | "outbound"
    | "opening_balance"
    | "adjustment_in"
    | "adjustment_out";
  quantity: number;
  before_quantity: number;
  after_quantity: number;
  reference_no: string | null;
  created_at: string;
  inventory_items:
    | { product_name: string; sku: string; unit: string }
    | { product_name: string; sku: string; unit: string }[]
    | null;
  warehouses: { name: string } | { name: string }[] | null;
};

type BatchRow = {
  id: string;
  lot_key: string;
  source_row_no: number | null;
  production_date: string | null;
  shelf_life_months: number | null;
  expiry_date: string | null;
  quantity: number;
  reserved_quantity: number;
  status: "available" | "quarantined" | "depleted";
  note: string | null;
  inventory_items:
    | {
        product_name: string;
        sku: string;
        specification: string | null;
        unit: string;
      }
    | {
        product_name: string;
        sku: string;
        specification: string | null;
        unit: string;
      }[]
    | null;
  warehouses: { name: string } | { name: string }[] | null;
};

type ImportRow = {
  id: string;
  source_file_name: string;
  source_sheet_name: string | null;
  total_rows: number;
  positive_rows: number;
  total_quantity: number;
  matched_product_rows: number;
  unmatched_product_rows: number;
  missing_production_date_rows: number;
  missing_shelf_life_rows: number;
  missing_barcode_rows: number;
  imported_at: string;
  metadata: {
    expired_positive_rows?: number;
    expiring_90_days_positive_rows?: number;
    duplicate_barcode_groups?: number;
    matching_rule?: string;
  } | null;
};

function relatedOne<T>(value: T | T[] | null) {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function roleLabel(roleCodes: string[]) {
  const labels: Record<string, string> = {
    admin: "系统管理员",
    chairman: "董事长",
    hr: "人事行政",
    finance: "财务",
    department_lead: "部门负责人",
    employee: "普通员工",
  };
  return roleCodes.map((code) => labels[code]).filter(Boolean).join(" · ");
}

function number(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: 3,
  }).format(Number(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDate(value: string | null) {
  if (!value) {
    return "待补充";
  }
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(`${value}T00:00:00+08:00`));
}

function categoryLabel(category: InventoryRow["category"]) {
  return {
    rice: "大米",
    oil: "食用油",
    gift: "礼盒",
    other: "调味杂粮",
    unknown: "未分类",
  }[category];
}

function movementLabel(type: MovementRow["movement_type"]) {
  return {
    inbound: "入库",
    outbound: "出库",
    opening_balance: "期初导入",
    adjustment_in: "盘盈",
    adjustment_out: "盘亏",
  }[type];
}

function MetricCard({
  label,
  value,
  note,
  icon,
  tone,
}: {
  label: string;
  value: string;
  note: string;
  icon: React.ReactNode;
  tone: string;
}) {
  return (
    <article className="group relative overflow-hidden rounded-md border border-white/80 bg-white/72 p-5  backdrop-blur-xl transition duration-300  hover:border-white hover:bg-white/82 ">
      <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-card  /70 " />
      <div className="pointer-events-none absolute -right-8 -top-10 size-28 rounded-full bg-muted blur-3xl transition group-hover:bg-muted" />
      <div className="flex items-start justify-between gap-3">
        <div className="relative">
          <div className="text-xs font-medium text-foreground">{label}</div>
          <div className="mt-3 text-[28px] font-semibold tracking-[-0.045em] text-foreground">
            {value}
          </div>
        </div>
        <div className={`relative grid size-10 place-items-center rounded-md  ring-1 ring-white/80 ${tone}`}>
          {icon}
        </div>
      </div>
      <div className="relative mt-4 border-t border-border pt-3 text-xs text-foreground">
        {note}
      </div>
    </article>
  );
}

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{
    created?: string;
    error?: string;
    view?: string;
    q?: string;
    category?: string;
    status?: string;
  }>;
}) {
  const configured = isSupabaseConfigured();
  const employee = configured ? await requireCurrentEmployee() : null;
  const feedback = await searchParams;
  const view =
    feedback.view === "movements"
      ? "movements"
      : feedback.view === "batches"
        ? "batches"
        : "stock";
  const query = feedback.q?.trim() ?? "";
  const categoryFilter = ["rice", "oil", "gift", "other"].includes(
    feedback.category ?? "",
  )
    ? feedback.category
    : "all";
  const statusFilter = ["available", "stockout", "quarantined"].includes(
    feedback.status ?? "",
  )
    ? feedback.status
    : "all";

  let warehouses: WarehouseRow[] = [];
  let inventory: InventoryRow[] = [];
  let movements: MovementRow[] = [];
  let batches: BatchRow[] = [];
  let latestImport: ImportRow | null = null;
  const departmentCode = employee?.departmentCode ?? null;
  let dataAvailable = !configured;

  if (employee) {
    const supabase = await createClient();

    const [warehouseResult, inventoryResult, movementResult, batchResult, importResult] =
      await Promise.all([
        supabase
          .from("warehouses")
          .select(
            "id, code, name, address, warehouse_type, partner_name, status",
          )
          .order("created_at"),
        supabase
          .from("inventory_items")
          .select(
            "id, warehouse_id, product_id, sku, product_name, specification, unit, category, barcode, case_specification, location_code, quantity, available_quantity, reserved_quantity, quarantined_quantity, safety_stock, last_imported_at, status, warehouses(name, code)",
          )
          .order("product_name")
          .limit(50),
        view === "movements"
          ? supabase
              .from("inventory_movements")
              .select(
                "id, movement_no, movement_type, quantity, before_quantity, after_quantity, reference_no, created_at, inventory_items(product_name, sku, unit), warehouses(name)",
              )
              .order("created_at", { ascending: false })
              .limit(50)
          : Promise.resolve({ data: [], error: null }),
        view === "batches"
          ? supabase
              .from("inventory_batches")
              .select(
                "id, lot_key, source_row_no, production_date, shelf_life_months, expiry_date, quantity, reserved_quantity, status, note, inventory_items(product_name, sku, specification, unit), warehouses(name)",
              )
              .order("expiry_date", { ascending: true, nullsFirst: false })
              .limit(50)
          : Promise.resolve({ data: [], error: null }),
        view === "batches"
          ? supabase
              .from("inventory_imports")
              .select(
                "id, source_file_name, source_sheet_name, total_rows, positive_rows, total_quantity, matched_product_rows, unmatched_product_rows, missing_production_date_rows, missing_shelf_life_rows, missing_barcode_rows, imported_at, metadata",
              )
              .eq("status", "completed")
              .order("imported_at", { ascending: false })
              .limit(1)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);

    dataAvailable =
      !warehouseResult.error &&
      !inventoryResult.error &&
      !batchResult.error &&
      !importResult.error;
    warehouses = (warehouseResult.data ?? []) as WarehouseRow[];
    inventory = (inventoryResult.data ?? []) as InventoryRow[];
    movements = (movementResult.data ?? []) as MovementRow[];
    batches = (batchResult.data ?? []) as BatchRow[];
    latestImport = (importResult.data ?? null) as ImportRow | null;
  }

  const canManage =
    !employee ||
    departmentCode === "DX-WH";
  const canExport = employee
    ? departmentCode === "DX-WH" || employee.roleCodes.includes("chairman")
    : false;
  const activeInventory = inventory.filter((item) => item.status === "active");
  const totalPhysicalQuantity = activeInventory.reduce(
    (total, item) => total + Number(item.quantity),
    0,
  );
  const totalAvailableQuantity = activeInventory.reduce(
    (total, item) => total + Number(item.available_quantity),
    0,
  );
  const totalQuarantinedQuantity = activeInventory.reduce(
    (total, item) => total + Number(item.quarantined_quantity),
    0,
  );
  const stockoutItems = activeInventory.filter(
    (item) => Number(item.quantity) === 0,
  );
  const normalizedQuery = query.toLocaleLowerCase("zh-CN");
  const filteredInventory = inventory.filter((item) => {
    const matchesQuery =
      !normalizedQuery ||
      [
        item.product_name,
        item.sku,
        item.specification,
        item.barcode,
        item.case_specification,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value).toLocaleLowerCase("zh-CN").includes(normalizedQuery),
        );
    const matchesCategory =
      categoryFilter === "all" || item.category === categoryFilter;
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "available" && Number(item.available_quantity) > 0) ||
      (statusFilter === "stockout" && Number(item.quantity) === 0) ||
      (statusFilter === "quarantined" &&
        Number(item.quarantined_quantity) > 0);
    return matchesQuery && matchesCategory && matchesStatus;
  });
  const today = new Date();
  const ninetyDaysLater = new Date(today);
  ninetyDaysLater.setDate(ninetyDaysLater.getDate() + 90);
  const expiryRiskBatches = batches.filter((batch) => {
    if (!batch.expiry_date || Number(batch.quantity) <= 0) {
      return false;
    }
    const expiry = new Date(`${batch.expiry_date}T00:00:00+08:00`);
    return expiry <= ninetyDaysLater;
  });
  return (
    <WorkflowShell
      activeItem="仓储管理"
      breadcrumb="供应链 / 仓储管理 / 仓储库存"
      currentUser={
        employee
          ? {
              name: employee.name,
              roleLabel: roleLabel(employee.roleCodes) || "内部员工",
            }
          : undefined
      }
    >
      <main className="relative isolate mx-auto max-w-[1440px] overflow-hidden p-4 sm:p-6 xl:p-8">
        <div className="mb-4 flex justify-end"><Link className="rounded-md bg-primary px-4 py-2 text-xs text-white" href="/inventory/control">进入精细库存控制</Link></div>
        <div className="pointer-events-none absolute inset-0 -z-10 bg-card" />
        <section className="ui-page-header">
          <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <h1>
                仓储库存中心
              </h1>
              <p className="mt-2 max-w-2xl">
                统一管理自有与第三方仓库存，区分物理、可用和隔离数量，并通过批次效期与先到期先出规则保障食品仓储安全。
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 self-start lg:self-auto">
              <div className="inline-flex items-center gap-2 rounded-md border border-border bg-white px-4 py-2 text-xs text-muted-foreground">
                <ShieldCheck className="size-4" />
                {canManage ? "仓储操作权限已启用" : "库存查询视图"}
              </div>
              {canExport && (
                <Link
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/85"
                  href="/inventory/export"
                  prefetch={false}
                >
                  <Download className="size-4" />
                  导出万纬库存表
                </Link>
              )}
            </div>
          </div>
        </section>

        {!dataAvailable && configured && (
          <div className="mt-5 rounded-lg border border-border bg-muted px-4 py-3 text-xs text-foreground">
            仓储数据表尚未初始化，请执行最新 Supabase 数据库迁移。
          </div>
        )}
        {feedback.created && (
          <div className="mt-5 rounded-lg border border-border bg-muted px-4 py-3 text-xs text-foreground">
            {feedback.created}
          </div>
        )}
        {feedback.error && (
          <div className="mt-5 rounded-lg border border-border bg-muted px-4 py-3 text-xs text-foreground">
            {feedback.error}
          </div>
        )}

        <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={<Boxes className="size-5" />}
            label="物理库存"
            note={`${activeInventory.length} 个 SKU · ${warehouses.filter((warehouse) => warehouse.status === "active").length} 个仓库`}
            tone="bg-card   text-foreground"
            value={number(totalPhysicalQuantity)}
          />
          <MetricCard
            icon={<PackageCheck className="size-5" />}
            label="可用库存"
            note={`隔离 ${number(totalQuarantinedQuantity)} · 预留 ${number(
              activeInventory.reduce(
                (total, item) => total + Number(item.reserved_quantity),
                0,
              ),
            )}`}
            tone="bg-card   text-foreground"
            value={number(totalAvailableQuantity)}
          />
          <MetricCard
            icon={<PackageX className="size-5" />}
            label="零库存 SKU"
            note="源表中保留、当前没有物理库存"
            tone="bg-card   text-foreground"
            value={`${stockoutItems.length} 项`}
          />
          <MetricCard
            icon={<Clock3 className="size-5" />}
            label="效期风险"
            note={`已隔离 ${number(totalQuarantinedQuantity)} · 90 天内到期`}
            tone="bg-card   text-foreground"
            value={`${expiryRiskBatches.length} 个批次`}
          />
        </section>

        <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(350px,.55fr)]">
          <section className="overflow-hidden rounded-md border border-white/85 bg-white/88  backdrop-blur-xl">
            <div className="flex flex-col gap-4 border-b border-border bg-white/45 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div>
                <h2 className="text-base font-semibold tracking-[-0.02em]">
                  {view === "stock"
                    ? "实时库存"
                    : view === "batches"
                      ? "批次与效期"
                      : "出入库流水"}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {view === "stock"
                    ? "按仓库与 SKU 查看物理、可用和隔离库存"
                    : view === "batches"
                      ? "生产日期、保质期和到期风险按批次追踪"
                      : "库存变化全程留痕，便于追溯业务来源"}
                </p>
              </div>
              <div className="flex rounded-md border border-border bg-muted p-1 text-xs">
                <Link
                  className={`rounded-lg px-3 py-2 ${
                    view === "stock"
                      ? "bg-white font-medium text-primary "
                      : "text-muted-foreground"
                  }`}
                  href="/inventory"
                >
                  实时库存
                </Link>
                <Link
                  className={`rounded-lg px-3 py-2 ${
                    view === "batches"
                      ? "bg-white font-medium text-primary "
                      : "text-muted-foreground"
                  }`}
                  href="/inventory?view=batches"
                >
                  批次效期
                </Link>
                <Link
                  className={`rounded-lg px-3 py-2 ${
                    view === "movements"
                      ? "bg-white font-medium text-primary "
                      : "text-muted-foreground"
                  }`}
                  href="/inventory?view=movements"
                >
                  出入库流水
                </Link>
              </div>
            </div>

            {view === "stock" && (
              <form
                className="grid gap-3 border-b border-border bg-muted px-5 py-4 backdrop-blur-md sm:grid-cols-[minmax(220px,1fr)_140px_140px_auto] sm:px-6"
                method="get"
              >
                <label className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    className="h-10 w-full rounded-md border border-white/90 bg-white/78 pl-9 pr-3 text-xs  outline-none backdrop-blur-md transition focus:border-border focus:bg-white"
                    defaultValue={query}
                    name="q"
                    placeholder="搜索商品、SKU、规格或条码"
                  />
                </label>
                <select
                  className="h-10 rounded-md border border-white/90 bg-white/78 px-3 text-xs  outline-none backdrop-blur-md transition focus:border-border focus:bg-white"
                  defaultValue={categoryFilter}
                  name="category"
                >
                  <option value="all">全部分类</option>
                  <option value="rice">大米</option>
                  <option value="oil">食用油</option>
                  <option value="gift">礼盒</option>
                  <option value="other">调味杂粮</option>
                </select>
                <select
                  className="h-10 rounded-md border border-white/90 bg-white/78 px-3 text-xs  outline-none backdrop-blur-md transition focus:border-border focus:bg-white"
                  defaultValue={statusFilter}
                  name="status"
                >
                  <option value="all">全部状态</option>
                  <option value="available">有可用库存</option>
                  <option value="stockout">零库存</option>
                  <option value="quarantined">存在隔离库存</option>
                </select>
                <button
                  className="h-10 rounded-md bg-primary px-5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                  type="submit"
                >
                  筛选
                </button>
              </form>
            )}

            {view === "stock" ? (
              filteredInventory.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1040px] text-left">
                    <thead className="bg-muted text-xs text-foreground">
                      <tr>
                        <th className="px-6 py-3 font-medium">商品 / SKU</th>
                        <th className="px-4 py-3 font-medium">仓库与库位</th>
                        <th className="px-4 py-3 font-medium">分类 / 箱规</th>
                        <th className="px-4 py-3 text-right font-medium">物理库存</th>
                        <th className="px-4 py-3 text-right font-medium">可用库存</th>
                        <th className="px-4 py-3 text-right font-medium">隔离</th>
                        <th className="px-6 py-3 font-medium">状态</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/65">
                      {filteredInventory.map((item) => {
                        const warehouse = relatedOne(item.warehouses);
                        const quarantined =
                          Number(item.quarantined_quantity) > 0;
                        const stockout = Number(item.quantity) === 0;
                        const warning =
                          !stockout &&
                          !quarantined &&
                          Number(item.safety_stock) > 0 &&
                          Number(item.available_quantity) <=
                            Number(item.safety_stock);
                        return (
                          <tr className="text-xs transition-colors hover:bg-muted" key={item.id}>
                            <td className="px-6 py-4">
                              <div className="font-medium">{item.product_name}</div>
                              <div className="mt-1 font-mono text-xs text-muted-foreground">
                                {item.sku}
                                {item.specification
                                  ? ` · ${item.specification}`
                                  : ""}
                              </div>
                              {item.barcode && (
                                <div className="mt-1 font-mono text-xs text-muted-foreground">
                                  条码 {item.barcode}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-4">
                              <div>{warehouse?.name ?? "未分配仓库"}</div>
                              <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                                <MapPin className="size-3" />
                                {item.location_code || "未设置库位"}
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <div>{categoryLabel(item.category)}</div>
                              <div className="mt-1 text-xs text-muted-foreground">
                                {item.case_specification || "箱规待补充"}
                              </div>
                            </td>
                            <td className="px-4 py-4 text-right font-semibold">
                              {number(item.quantity)} {item.unit}
                            </td>
                            <td className="px-4 py-4 text-right font-semibold text-foreground">
                              {number(item.available_quantity)} {item.unit}
                            </td>
                            <td className="px-4 py-4 text-right text-foreground">
                              {number(item.quarantined_quantity)} {item.unit}
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={`rounded-full px-2.5 py-1 text-xs ${
                                  quarantined
                                    ? "bg-muted text-foreground"
                                    : stockout
                                      ? "bg-muted text-foreground"
                                      : warning
                                    ? "bg-muted text-foreground"
                                    : "bg-muted text-foreground"
                                }`}
                              >
                                {quarantined
                                  ? "存在隔离"
                                  : stockout
                                    ? "零库存"
                                    : warning
                                      ? "低库存"
                                      : "可正常出库"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="px-6 py-16 text-center">
                  <Boxes className="mx-auto size-10 text-muted-foreground/45" />
                  <h3 className="mt-4 text-sm font-medium">
                    {inventory.length ? "没有符合条件的库存" : "还没有库存商品"}
                  </h3>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {inventory.length
                      ? "请调整关键词、分类或库存状态后重试。"
                      : "先创建仓库与 SKU，再通过入库流水增加库存。"}
                  </p>
                </div>
              )
            ) : view === "batches" ? (
              batches.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] text-left">
                    <thead className="bg-muted text-xs text-foreground">
                      <tr>
                        <th className="px-6 py-3 font-medium">商品 / 批次</th>
                        <th className="px-4 py-3 font-medium">生产日期</th>
                        <th className="px-4 py-3 font-medium">到期日期</th>
                        <th className="px-4 py-3 text-right font-medium">
                          批次数量
                        </th>
                        <th className="px-4 py-3 font-medium">来源</th>
                        <th className="px-6 py-3 font-medium">效期状态</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/65">
                      {batches.map((batch) => {
                        const item = relatedOne(batch.inventory_items);
                        const warehouse = relatedOne(batch.warehouses);
                        const expiry = batch.expiry_date
                          ? new Date(`${batch.expiry_date}T00:00:00+08:00`)
                          : null;
                        const expired =
                          batch.status === "quarantined" ||
                          Boolean(expiry && expiry < today);
                        const expiring =
                          !expired &&
                          Boolean(expiry && expiry <= ninetyDaysLater);
                        return (
                          <tr className="text-xs transition-colors hover:bg-muted" key={batch.id}>
                            <td className="px-6 py-4">
                              <div className="font-medium">
                                {item?.product_name ?? "库存商品"}
                              </div>
                              <div className="mt-1 font-mono text-xs text-muted-foreground">
                                {item?.sku ?? "SKU"}
                                {item?.specification
                                  ? ` · ${item.specification}`
                                  : ""}
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              {formatDate(batch.production_date)}
                            </td>
                            <td className="px-4 py-4">
                              <div>{formatDate(batch.expiry_date)}</div>
                              <div className="mt-1 text-xs text-muted-foreground">
                                {batch.shelf_life_months
                                  ? `${batch.shelf_life_months} 个月`
                                  : "保质期待补充"}
                              </div>
                            </td>
                            <td className="px-4 py-4 text-right font-semibold">
                              {number(batch.quantity)} {item?.unit ?? ""}
                            </td>
                            <td className="px-4 py-4">
                              <div>{warehouse?.name ?? "仓库"}</div>
                              <div className="mt-1 text-xs text-muted-foreground">
                                {batch.source_row_no
                                  ? `源表第 ${batch.source_row_no} 行`
                                  : "手工出入库"}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={`rounded-full px-2.5 py-1 text-xs ${
                                  expired
                                    ? "bg-muted text-foreground"
                                    : expiring
                                      ? "bg-muted text-foreground"
                                      : batch.status === "depleted"
                                        ? "bg-muted text-foreground"
                                        : "bg-muted text-foreground"
                                }`}
                              >
                                {expired
                                  ? "已到期隔离"
                                  : expiring
                                    ? "90 天内到期"
                                    : batch.status === "depleted"
                                      ? "零库存"
                                      : batch.expiry_date
                                        ? "效期正常"
                                        : "效期待补充"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="px-6 py-16 text-center">
                  <Clock3 className="mx-auto size-10 text-muted-foreground/45" />
                  <h3 className="mt-4 text-sm font-medium">还没有库存批次</h3>
                  <p className="mt-2 text-xs text-muted-foreground">
                    导入库存快照或完成入库后，批次效期会显示在这里。
                  </p>
                </div>
              )
            ) : movements.length ? (
              <div className="divide-y divide-border/65 px-5 sm:px-6">
                {movements.map((movement) => {
                  const item = relatedOne(movement.inventory_items);
                  const warehouse = relatedOne(movement.warehouses);
                  return (
                    <article
                      className="grid gap-3 py-4 sm:grid-cols-[42px_minmax(0,1fr)_auto] sm:items-center"
                      key={movement.id}
                    >
                      <div
                        className={`grid size-9 place-items-center rounded-md ${
                          ["inbound", "opening_balance", "adjustment_in"].includes(
                            movement.movement_type,
                          )
                            ? "bg-muted text-foreground"
                            : "bg-muted text-foreground"
                        }`}
                      >
                        {["inbound", "opening_balance", "adjustment_in"].includes(
                          movement.movement_type,
                        ) ? (
                          <ArrowDownToLine className="size-4" />
                        ) : (
                          <ArrowUpFromLine className="size-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-medium">
                            {item?.product_name ?? "库存商品"}
                          </span>
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                            {movementLabel(movement.movement_type)}
                          </span>
                          <span className="font-mono text-xs text-muted-foreground">
                            {movement.movement_no}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {warehouse?.name ?? "仓库"} · {item?.sku ?? "SKU"} ·{" "}
                          {formatDateTime(movement.created_at)}
                          {movement.reference_no
                            ? ` · 来源 ${movement.reference_no}`
                            : ""}
                        </div>
                      </div>
                      <div className="text-right">
                        <div
                          className={`text-xs font-semibold ${
                            ["inbound", "opening_balance", "adjustment_in"].includes(
                              movement.movement_type,
                            )
                              ? "text-foreground"
                              : "text-foreground"
                          }`}
                        >
                          {[
                            "inbound",
                            "opening_balance",
                            "adjustment_in",
                          ].includes(movement.movement_type)
                            ? "+"
                            : "-"}
                          {number(movement.quantity)} {item?.unit ?? ""}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {number(movement.before_quantity)} →{" "}
                          {number(movement.after_quantity)}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="px-6 py-16 text-center">
                <ClipboardList className="mx-auto size-10 text-muted-foreground/45" />
                <h3 className="mt-4 text-sm font-medium">还没有出入库流水</h3>
                <p className="mt-2 text-xs text-muted-foreground">
                  完成第一笔入库后，库存变化会显示在这里。
                </p>
              </div>
            )}
          </section>

          <div className="space-y-5">
            {latestImport && (
              <section className="overflow-hidden rounded-md border border-white/85 bg-card  backdrop-blur-xl">
                <div className="border-b border-border px-5 py-5 sm:px-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xs font-medium tracking-[0.12em] text-foreground">
                        LATEST INVENTORY SNAPSHOT
                      </div>
                      <h2 className="mt-2 text-base font-semibold">万纬库存导入</h2>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {latestImport.source_file_name} ·{" "}
                        {formatDateTime(latestImport.imported_at)}
                      </p>
                    </div>
                    <div className="grid size-10 place-items-center rounded-md bg-white/82 text-foreground  ring-1 ring-white backdrop-blur-md">
                      <FileSpreadsheet className="size-5" />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-px bg-muted">
                  {[
                    ["源表明细", `${latestImport.total_rows} 条`],
                    ["库存总量", number(latestImport.total_quantity)],
                    ["已关联产品", `${latestImport.matched_product_rows} 条`],
                    ["待完善主档", `${latestImport.unmatched_product_rows} 条`],
                  ].map(([label, value]) => (
                    <div className="bg-white/52 px-5 py-4 backdrop-blur-md" key={label}>
                      <div className="text-xs text-muted-foreground">{label}</div>
                      <div className="mt-1 text-sm font-semibold">{value}</div>
                    </div>
                  ))}
                </div>
                <div className="space-y-2 px-5 py-4 text-xs leading-5 text-muted-foreground sm:px-6">
                  <div className="flex gap-2">
                    <CircleAlert className="mt-0.5 size-3.5 shrink-0 text-foreground" />
                    缺生产日期 {latestImport.missing_production_date_rows} 条 ·
                    缺保质期 {latestImport.missing_shelf_life_rows} 条 · 缺条码{" "}
                    {latestImport.missing_barcode_rows} 条
                  </div>
                  <div className="flex gap-2">
                    <Database className="mt-0.5 size-3.5 shrink-0 text-foreground" />
                    已按文件指纹防重复导入，条码冲突不会自动覆盖产品主档。
                  </div>
                </div>
              </section>
            )}

            {warehouses.length > 0 && (
              <section className="rounded-md border border-white/85 bg-white/72 p-5  backdrop-blur-xl sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold">仓库档案</h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      自有仓与第三方仓统一管理
                    </p>
                  </div>
                  <Warehouse className="size-5 text-primary/65" />
                </div>
                <div className="mt-4 space-y-3">
                  {warehouses.map((warehouse) => (
                    <div
                      className="rounded-md border border-white/90 bg-muted px-4 py-3  backdrop-blur-md transition hover:border-border hover:bg-white/88"
                      key={warehouse.id}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-xs font-medium">{warehouse.name}</div>
                        <span className="rounded-full bg-muted px-2 py-1 text-xs text-foreground">
                          {warehouse.warehouse_type === "third_party"
                            ? "第三方仓"
                            : warehouse.warehouse_type === "virtual"
                              ? "虚拟仓"
                              : "自有仓"}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {warehouse.code}
                        {warehouse.partner_name
                          ? ` · 服务方 ${warehouse.partner_name}`
                          : ""}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {canManage ? (
              <>
                {!warehouses.length ? (
                  <section className="rounded-md border border-white/85 bg-white/76 p-5  backdrop-blur-xl sm:p-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <h2 className="text-base font-semibold">创建第一个仓库</h2>
                        <p className="mt-1 text-xs text-muted-foreground">
                          建立仓库档案后才能录入 SKU
                        </p>
                      </div>
                      <Warehouse className="size-5 text-primary/65" />
                    </div>
                    <form action={createWarehouse} className="mt-5 space-y-4">
                      <label className="block text-xs text-muted-foreground">
                        仓库名称
                        <input
                          className="mt-1.5 h-10 w-full rounded-md border border-border px-3 text-xs outline-none focus:border-primary/40"
                          name="name"
                          placeholder="例如：德馨淼盛主仓"
                          required
                        />
                      </label>
                      <label className="block text-xs text-muted-foreground">
                        仓库编码
                        <input
                          className="mt-1.5 h-10 w-full rounded-md border border-border px-3 text-xs uppercase outline-none focus:border-primary/40"
                          name="code"
                          placeholder="例如：DX-WH-01"
                          required
                        />
                      </label>
                      <label className="block text-xs text-muted-foreground">
                        仓库地址
                        <input
                          className="mt-1.5 h-10 w-full rounded-md border border-border px-3 text-xs outline-none focus:border-primary/40"
                          name="address"
                          placeholder="选填"
                        />
                      </label>
                      <button
                        className="h-10 w-full rounded-md bg-primary text-xs font-medium text-primary-foreground"
                        type="submit"
                      >
                        创建仓库
                      </button>
                    </form>
                  </section>
                ) : (
                  <section className="rounded-md border border-white/85 bg-white/76 p-5  backdrop-blur-xl sm:p-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <h2 className="text-base font-semibold">新增库存商品</h2>
                        <p className="mt-1 text-xs text-muted-foreground">
                          建立 SKU、库位和安全库存
                        </p>
                      </div>
                      <PackagePlus className="size-5 text-primary/65" />
                    </div>
                    <form action={createInventoryItem} className="mt-5 space-y-4">
                      <label className="block text-xs text-muted-foreground">
                        所属仓库
                        <select
                          className="mt-1.5 h-10 w-full rounded-md border border-border bg-white px-3 text-xs outline-none focus:border-primary/40"
                          name="warehouseId"
                          required
                        >
                          {warehouses
                            .filter((warehouse) => warehouse.status === "active")
                            .map((warehouse) => (
                              <option key={warehouse.id} value={warehouse.id}>
                                {warehouse.name} · {warehouse.code}
                              </option>
                            ))}
                        </select>
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <label className="text-xs text-muted-foreground">
                          SKU 编码
                          <input
                            className="mt-1.5 h-10 w-full rounded-md border border-border px-3 text-xs uppercase outline-none focus:border-primary/40"
                            name="sku"
                            placeholder="DX-R001"
                            required
                          />
                        </label>
                        <label className="text-xs text-muted-foreground">
                          计量单位
                          <input
                            className="mt-1.5 h-10 w-full rounded-md border border-border px-3 text-xs outline-none focus:border-primary/40"
                            defaultValue="件"
                            name="unit"
                            required
                          />
                        </label>
                      </div>
                      <label className="block text-xs text-muted-foreground">
                        商品名称
                        <input
                          className="mt-1.5 h-10 w-full rounded-md border border-border px-3 text-xs outline-none focus:border-primary/40"
                          name="productName"
                          placeholder="输入商品完整名称"
                          required
                        />
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <label className="text-xs text-muted-foreground">
                          规格
                          <input
                            className="mt-1.5 h-10 w-full rounded-md border border-border px-3 text-xs outline-none focus:border-primary/40"
                            name="specification"
                            placeholder="5kg × 4袋"
                          />
                        </label>
                        <label className="text-xs text-muted-foreground">
                          库位
                          <input
                            className="mt-1.5 h-10 w-full rounded-md border border-border px-3 text-xs uppercase outline-none focus:border-primary/40"
                            name="locationCode"
                            placeholder="A-01-01"
                          />
                        </label>
                      </div>
                      <label className="block text-xs text-muted-foreground">
                        安全库存
                        <input
                          className="mt-1.5 h-10 w-full rounded-md border border-border px-3 text-xs outline-none focus:border-primary/40"
                          defaultValue="0"
                          min="0"
                          name="safetyStock"
                          step="0.001"
                          type="number"
                        />
                      </label>
                      <button
                        className="h-10 w-full rounded-md bg-primary text-xs font-medium text-primary-foreground"
                        type="submit"
                      >
                        保存库存商品
                      </button>
                    </form>
                  </section>
                )}

                {inventory.length > 0 && (
                  <section className="rounded-md border border-white/85 bg-white/76 p-5  backdrop-blur-xl sm:p-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <h2 className="text-base font-semibold">办理出入库</h2>
                        <p className="mt-1 text-xs text-muted-foreground">
                          库存数量将在数据库内原子更新
                        </p>
                      </div>
                      <ArrowDownToLine className="size-5 text-primary/65" />
                    </div>
                    <form
                      action={recordInventoryMovement}
                      className="mt-5 space-y-4"
                    >
                      <label className="block text-xs text-muted-foreground">
                        库存商品
                        <select
                          className="mt-1.5 h-10 w-full rounded-md border border-border bg-white px-3 text-xs outline-none focus:border-primary/40"
                          name="inventoryItemId"
                          required
                        >
                          {activeInventory.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.sku} · {item.product_name}（可用{" "}
                              {number(item.available_quantity)} {item.unit}）
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <label className="text-xs text-muted-foreground">
                          业务类型
                          <select
                            className="mt-1.5 h-10 w-full rounded-md border border-border bg-white px-3 text-xs outline-none focus:border-primary/40"
                            defaultValue="inbound"
                            name="movementType"
                          >
                            <option value="inbound">入库</option>
                            <option value="outbound">出库</option>
                          </select>
                        </label>
                        <label className="text-xs text-muted-foreground">
                          数量
                          <input
                            className="mt-1.5 h-10 w-full rounded-md border border-border px-3 text-xs outline-none focus:border-primary/40"
                            min="0.001"
                            name="quantity"
                            required
                            step="0.001"
                            type="number"
                          />
                        </label>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <label className="text-xs text-muted-foreground">
                          生产日期
                          <input
                            className="mt-1.5 h-10 w-full rounded-md border border-border px-3 text-xs outline-none focus:border-primary/40"
                            name="productionDate"
                            type="date"
                          />
                        </label>
                        <label className="text-xs text-muted-foreground">
                          保质期（月）
                          <input
                            className="mt-1.5 h-10 w-full rounded-md border border-border px-3 text-xs outline-none focus:border-primary/40"
                            max="120"
                            min="1"
                            name="shelfLifeMonths"
                            placeholder="入库时填写"
                            type="number"
                          />
                        </label>
                      </div>
                      <label className="block text-xs text-muted-foreground">
                        来源单号
                        <input
                          className="mt-1.5 h-10 w-full rounded-md border border-border px-3 text-xs outline-none focus:border-primary/40"
                          name="referenceNo"
                          placeholder="采购单、销售单或配送单号"
                        />
                      </label>
                      <label className="block text-xs text-muted-foreground">
                        备注
                        <textarea
                          className="mt-1.5 min-h-20 w-full resize-y rounded-md border border-border px-3 py-2.5 text-xs outline-none focus:border-primary/40"
                          maxLength={300}
                          name="note"
                          placeholder="填写经办说明或异常情况"
                        />
                      </label>
                      <button
                        className="h-10 w-full rounded-md bg-primary text-xs font-medium text-primary-foreground"
                        type="submit"
                      >
                        确认并更新库存
                      </button>
                    </form>
                  </section>
                )}
              </>
            ) : (
              <section className="rounded-md border border-white/85 bg-white/72 p-6 text-center  backdrop-blur-xl">
                <ShieldCheck className="mx-auto size-8 text-muted-foreground/50" />
                <h2 className="mt-3 text-sm font-medium">当前为库存查询视图</h2>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  仓储部门人员和系统管理员可以维护 SKU 并办理出入库。
                </p>
              </section>
            )}
          </div>
        </div>
      </main>
    </WorkflowShell>
  );
}
