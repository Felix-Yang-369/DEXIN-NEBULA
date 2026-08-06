import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BadgeDollarSign,
  BriefcaseBusiness,
  CircleDollarSign,
  CirclePlus,
  ClipboardCheck,
  ShoppingCart,
  TrendingUp,
} from "lucide-react";
import { WorkflowShell } from "@/features/approvals/workflow-shell";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import {
  SalesOrderBuilder,
  type SalesCustomerOption,
  type SalesOpportunityOption,
  type SalesProductOption,
} from "@/features/sales/sales-order-builder";
import {
  createSalesOpportunityAction,
  fulfillSalesOrderAction,
  transitionSalesOrderAction,
} from "@/features/sales/server-actions";
import { availableSalesOrderTransitions } from "@/features/sales/order-workflow";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "销售业务中心",
  description: "德馨星云销售机会、订单与交易履约中心",
};

export const dynamic = "force-dynamic";

type OpportunityRow = {
  id: string;
  opportunity_no: string;
  customer_id: string;
  title: string;
  stage: "lead" | "qualified" | "proposal" | "negotiation" | "won" | "lost";
  expected_amount_cny: number | string;
  probability: number;
  expected_close_on: string | null;
  next_action: string | null;
  customers: { name: string } | { name: string }[] | null;
  employees: { name: string } | { name: string }[] | null;
};

type OrderRow = {
  id: string;
  order_no: string;
  status: "draft" | "confirmed" | "fulfilling" | "completed" | "cancelled";
  price_type: "retail" | "group" | "dropship";
  order_date: string;
  requested_delivery_on: string | null;
  total_cny: number | string;
  legal_entity_id: string | null;
  customers: { name: string } | { name: string }[] | null;
  customer_legal_entities:
    | { legal_name: string }
    | { legal_name: string }[]
    | null;
  employees: { name: string } | { name: string }[] | null;
  sales_order_items: Array<{
    id: string;
    product_name: string;
    quantity: number | string;
  }> | null;
};

type ProductRow = {
  id: string;
  code: string;
  name: string;
  specification: string | null;
  product_prices: Array<{
    price_type: "procurement" | "retail" | "group" | "dropship";
    amount_cny: number | string;
    status: "active" | "expired";
  }> | null;
};

function relatedOne<T>(value: T | T[] | null) {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function money(value: number | string) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function date(value: string | null) {
  if (!value) return "待确定";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(`${value}T00:00:00+08:00`));
}

const stageLabels: Record<OpportunityRow["stage"], string> = {
  lead: "线索",
  qualified: "已验证",
  proposal: "方案报价",
  negotiation: "商务谈判",
  won: "已成交",
  lost: "已丢失",
};

const orderStatusLabels: Record<OrderRow["status"], string> = {
  draft: "草稿",
  confirmed: "已确认",
  fulfilling: "履约中",
  completed: "已完成",
  cancelled: "已取消",
};

const orderStatusTones: Record<OrderRow["status"], string> = {
  draft: "bg-slate-100 text-slate-600",
  confirmed: "bg-cyan-50 text-cyan-700",
  fulfilling: "bg-blue-50 text-blue-700",
  completed: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-red-50 text-red-600",
};

function roleLabel(roleCodes: string[]) {
  const labels: Record<string, string> = {
    admin: "系统管理员",
    chairman: "董事长",
    finance: "财务",
    department_lead: "部门负责人",
    employee: "内部员工",
  };
  return roleCodes.map((code) => labels[code]).filter(Boolean).join(" · ");
}

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; updated?: string; error?: string }>;
}) {
  const employee = await requireCurrentEmployee();
  const feedback = await searchParams;
  const supabase = await createClient();
  const [customerResult, entityResult, productResult, opportunityResult, orderResult, manageResult, inventoryManageResult, warehouseResult] =
    await Promise.all([
      supabase
        .from("customers")
        .select("id, customer_no, name, level, status")
        .neq("status", "inactive")
        .order("level")
        .order("name")
        .limit(240),
      supabase
        .from("customer_legal_entities")
        .select("id, customer_id, legal_name, is_default, status")
        .eq("status", "active")
        .order("is_default", { ascending: false }),
      supabase
        .from("products")
        .select(
          "id, code, name, specification, product_prices(price_type, amount_cny, status)",
        )
        .eq("status", "active")
        .order("code")
        .limit(400),
      supabase
        .from("sales_opportunities")
        .select(
          "id, opportunity_no, customer_id, title, stage, expected_amount_cny, probability, expected_close_on, next_action, customers(name), employees!sales_opportunities_owner_employee_id_fkey(name)",
        )
        .order("updated_at", { ascending: false })
        .limit(80),
      supabase
        .from("sales_orders")
        .select(
          "id, order_no, status, price_type, order_date, requested_delivery_on, total_cny, legal_entity_id, customers(name), customer_legal_entities(legal_name), employees!sales_orders_owner_employee_id_fkey(name), sales_order_items(id, product_name, quantity)",
        )
        .order("created_at", { ascending: false })
        .limit(80),
      supabase.rpc("can_manage_customers"),
      supabase.rpc("can_manage_inventory"),
      supabase
        .from("warehouses")
        .select("id, code, name")
        .eq("status", "active")
        .order("name"),
    ]);

  const dataAvailable = !opportunityResult.error && !orderResult.error;
  const canManage = Boolean(manageResult.data);
  const canFulfill = Boolean(inventoryManageResult.data);
  const warehouses = warehouseResult.data ?? [];
  const entities = entityResult.data ?? [];
  const customers: SalesCustomerOption[] = (customerResult.data ?? []).map(
    (customer) => ({
      id: customer.id,
      customerNo: customer.customer_no,
      name: customer.name,
      level: customer.level,
      legalEntities: entities
        .filter((entity) => entity.customer_id === customer.id)
        .map((entity) => ({
          id: entity.id,
          legalName: entity.legal_name,
          isDefault: entity.is_default,
        })),
    }),
  );
  const products: SalesProductOption[] = (
    (productResult.data ?? []) as ProductRow[]
  ).map((product) => ({
    id: product.id,
    code: product.code,
    name: product.name,
    specification: product.specification,
    prices: Object.fromEntries(
      (product.product_prices ?? [])
        .filter(
          (price) =>
            price.status === "active" && price.price_type !== "procurement",
        )
        .map((price) => [price.price_type, Number(price.amount_cny)]),
    ),
  }));
  const opportunities = (opportunityResult.data ?? []) as OpportunityRow[];
  const opportunityOptions: SalesOpportunityOption[] = opportunities
    .filter((opportunity) => !["won", "lost"].includes(opportunity.stage))
    .map((opportunity) => ({
      id: opportunity.id,
      customerId: opportunity.customer_id,
      opportunityNo: opportunity.opportunity_no,
      title: opportunity.title,
    }));
  const orders = (orderResult.data ?? []) as OrderRow[];
  const pipelineAmount = opportunities
    .filter((opportunity) => !["won", "lost"].includes(opportunity.stage))
    .reduce((sum, opportunity) => sum + Number(opportunity.expected_amount_cny), 0);
  const confirmedAmount = orders
    .filter((order) => ["confirmed", "fulfilling", "completed"].includes(order.status))
    .reduce((sum, order) => sum + Number(order.total_cny), 0);

  return (
    <WorkflowShell
      activeItem="销售管理"
      breadcrumb="业务管理 / 销售业务"
      currentUser={{
        name: employee.name,
        roleLabel: roleLabel(employee.roleCodes) || employee.title || "内部员工",
      }}
    >
      <main className="mx-auto max-w-[1600px] p-4 sm:p-6 xl:p-8">
        <section className="relative overflow-hidden rounded-[26px] bg-[radial-gradient(circle_at_78%_20%,rgba(24,175,179,.25),transparent_28%),linear-gradient(130deg,#071d34,#0a385d_58%,#0c6470)] px-6 py-7 text-white shadow-[0_24px_68px_-38px_rgba(6,24,44,.9)] sm:px-8">
          <ShoppingCart className="pointer-events-none absolute right-12 top-1/2 hidden size-40 -translate-y-1/2 text-white/[0.07] sm:block" />
          <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#6bd7d4]">
                CRM · Sales Operations
              </div>
              <h1 className="mt-3 text-2xl font-semibold tracking-[-0.035em] sm:text-[30px]">
                销售业务中心
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/62">
                用销售机会承接客户需求，用销售订单固化交易与法律实体，为后续库存履约、收入和应收联动建立唯一业务主线。
              </p>
            </div>
            <div className="flex gap-2">
              <Link className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-[11px] backdrop-blur" href="/customers">
                客户档案
              </Link>
              <Link className="rounded-xl bg-[#6bd7d4] px-4 py-3 text-[11px] font-semibold text-[#071d34]" href="/quotes">
                报价中心
              </Link>
            </div>
          </div>
        </section>

        {!dataAvailable && (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
            销售业务数据表尚未初始化，请先执行 V0.8 销售业务迁移。
          </div>
        )}
        {(feedback.created || feedback.updated) && (
          <div className="mt-5 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-xs text-cyan-800">
            {feedback.created || feedback.updated}
          </div>
        )}
        {feedback.error && (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
            {feedback.error}
          </div>
        )}

        <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["销售管道", money(pipelineAmount), `${opportunities.filter((item) => !["won", "lost"].includes(item.stage)).length} 个进行中机会`, TrendingUp],
            ["订单草稿", `${orders.filter((item) => item.status === "draft").length} 单`, "待确认法律实体与交付信息", BriefcaseBusiness],
            ["已确认订单", money(confirmedAmount), "下一步进入履约与出库", ClipboardCheck],
            ["活跃客户", `${new Set(orders.map((item) => relatedOne(item.customers)?.name).filter(Boolean)).size} 家`, "已建立销售订单的客户", CircleDollarSign],
          ].map(([label, value, note, Icon]) => {
            const MetricIcon = Icon as typeof TrendingUp;
            return (
              <article className="rounded-[22px] border border-white bg-white/82 p-5 shadow-[0_18px_45px_-34px_rgba(9,57,91,.45)]" key={String(label)}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-[10px] text-muted-foreground">{String(label)}</div>
                    <div className="mt-2 text-2xl font-semibold tracking-[-0.04em]">{String(value)}</div>
                  </div>
                  <span className="grid size-10 place-items-center rounded-xl bg-[#dff5f4] text-[#0d7580]">
                    <MetricIcon className="size-5" />
                  </span>
                </div>
                <div className="mt-4 border-t border-border/70 pt-3 text-[9px] text-muted-foreground">{String(note)}</div>
              </article>
            );
          })}
        </section>

        <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(380px,.65fr)]">
          <div className="space-y-5">
            <section className="scroll-mt-24 overflow-hidden rounded-[22px] border border-border/80 bg-white" id="orders">
              <div className="flex items-center justify-between border-b border-border/70 px-5 py-5 sm:px-6">
                <div>
                  <h2 className="text-base font-semibold">销售订单</h2>
                  <p className="mt-1 text-[10px] text-muted-foreground">订单、客户法律实体和商品交易快照</p>
                </div>
                <BadgeDollarSign className="size-5 text-primary" />
              </div>
              {orders.length ? (
                <div className="divide-y divide-border/70">
                  {orders.map((order) => {
                    const customer = relatedOne(order.customers);
                    const entity = relatedOne(order.customer_legal_entities);
                    return (
                      <article className="px-5 py-4 sm:px-6" key={order.id}>
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-[10px] text-[#0d6475]">{order.order_no}</span>
                              <span className={`rounded-full px-2.5 py-1 text-[9px] ${orderStatusTones[order.status]}`}>{orderStatusLabels[order.status]}</span>
                              {!order.legal_entity_id && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[9px] text-amber-700">待绑定法律实体</span>}
                            </div>
                            <h3 className="mt-2 text-sm font-semibold">{customer?.name ?? "客户"}</h3>
                            <p className="mt-1 text-[10px] text-muted-foreground">
                              {entity?.legal_name ?? "草稿未选择交易实体"} · {order.sales_order_items?.length ?? 0} 项商品 · 交付 {date(order.requested_delivery_on)}
                            </p>
                          </div>
                          <div className="flex flex-col items-start gap-2 lg:items-end">
                            <div className="text-lg font-semibold">{money(order.total_cny)}</div>
                            {canManage && availableSalesOrderTransitions(order.status).length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {availableSalesOrderTransitions(order.status).includes("confirmed") && (
                                  <form action={transitionSalesOrderAction}>
                                    <input name="orderId" type="hidden" value={order.id} />
                                    <input name="targetStatus" type="hidden" value="confirmed" />
                                    <button className="rounded-lg bg-[#0d6475] px-3 py-2 text-[9px] font-medium text-white" type="submit">确认订单</button>
                                  </form>
                                )}
                                {availableSalesOrderTransitions(order.status).includes("cancelled") && <form action={transitionSalesOrderAction} className="flex gap-1.5">
                                  <input name="orderId" type="hidden" value={order.id} />
                                  <input name="targetStatus" type="hidden" value="cancelled" />
                                  <input className="h-8 w-32 rounded-lg border border-border px-2 text-[9px]" name="note" placeholder="取消原因" required />
                                  <button className="rounded-lg border border-red-200 px-3 text-[9px] text-red-600" type="submit">取消</button>
                                </form>}
                              </div>
                            )}
                            {canFulfill && order.status === "confirmed" && warehouses.length > 0 && (
                              <form action={fulfillSalesOrderAction} className="grid w-full gap-2 rounded-xl border border-cyan-100 bg-cyan-50/60 p-3 sm:w-[360px] sm:grid-cols-2">
                                <input name="orderId" type="hidden" value={order.id} />
                                <select className="h-8 rounded-lg border border-cyan-200 bg-white px-2 text-[9px]" name="warehouseId" required>
                                  {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.code} · {warehouse.name}</option>)}
                                </select>
                                <input className="h-8 rounded-lg border border-cyan-200 bg-white px-2 text-[9px]" name="recipientName" placeholder="收货人" />
                                <input className="h-8 rounded-lg border border-cyan-200 bg-white px-2 text-[9px]" name="recipientPhone" placeholder="联系电话" />
                                <input className="h-8 rounded-lg border border-cyan-200 bg-white px-2 text-[9px]" name="deliveryAddress" placeholder="配送地址" required />
                                <input className="h-8 rounded-lg border border-cyan-200 bg-white px-2 text-[9px]" name="note" placeholder="履约说明" />
                                <button className="h-8 rounded-lg bg-[#0d6475] text-[9px] font-medium text-white" type="submit">出库并生成应收</button>
                              </form>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="px-6 py-14 text-center text-xs text-muted-foreground">还没有销售订单</div>
              )}
            </section>

            <section className="scroll-mt-24 overflow-hidden rounded-[22px] border border-border/80 bg-white" id="opportunities">
              <div className="border-b border-border/70 px-5 py-5 sm:px-6">
                <h2 className="text-base font-semibold">销售机会管道</h2>
                <p className="mt-1 text-[10px] text-muted-foreground">从需求线索到报价、谈判与成交</p>
              </div>
              <div className="divide-y divide-border/70">
                {opportunities.length ? opportunities.map((opportunity) => (
                  <article className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_120px_100px] sm:items-center sm:px-6" key={opportunity.id}>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[9px] text-primary">{opportunity.opportunity_no}</span>
                        <span className="rounded-full bg-[#edf4f7] px-2 py-1 text-[9px] text-[#526b7e]">{stageLabels[opportunity.stage]}</span>
                      </div>
                      <h3 className="mt-2 text-xs font-semibold">{opportunity.title}</h3>
                      <p className="mt-1 text-[9px] text-muted-foreground">{relatedOne(opportunity.customers)?.name} · {opportunity.next_action || "待制定下一步"}</p>
                    </div>
                    <div>
                      <div className="text-[9px] text-muted-foreground">预计成交</div>
                      <div className="mt-1 text-xs font-medium">{date(opportunity.expected_close_on)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-semibold">{money(opportunity.expected_amount_cny)}</div>
                      <div className="mt-1 text-[9px] text-muted-foreground">{opportunity.probability}% 概率</div>
                    </div>
                  </article>
                )) : <div className="px-6 py-12 text-center text-xs text-muted-foreground">还没有销售机会</div>}
              </div>
            </section>
          </div>

          {canManage && dataAvailable ? (
            <div className="space-y-5">
              <section className="rounded-[22px] border border-border/80 bg-white p-5 sm:p-6">
                <div className="flex items-center gap-2">
                  <CirclePlus className="size-4 text-primary" />
                  <h2 className="text-sm font-semibold">新建销售机会</h2>
                </div>
                <form action={createSalesOpportunityAction} className="mt-5 space-y-3">
                  <select className="h-10 w-full rounded-xl border border-border bg-white px-3 text-xs" name="customerId" required>
                    <option value="">选择客户</option>
                    {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.level}级 · {customer.name}</option>)}
                  </select>
                  <select className="h-10 w-full rounded-xl border border-border bg-white px-3 text-xs" name="legalEntityId">
                    <option value="">暂不指定法律实体</option>
                    {customers.flatMap((customer) => customer.legalEntities.map((entity) => <option key={entity.id} value={entity.id}>{customer.name} · {entity.legalName}</option>))}
                  </select>
                  <input className="h-10 w-full rounded-xl border border-border px-3 text-xs" name="title" placeholder="机会名称 / 客户需求" required />
                  <div className="grid grid-cols-2 gap-3">
                    <input className="h-10 rounded-xl border border-border px-3 text-xs" min="0" name="expectedAmountCny" placeholder="预计金额" required step="0.01" type="number" />
                    <input className="h-10 rounded-xl border border-border px-3 text-xs" defaultValue="30" max="100" min="0" name="probability" placeholder="成交概率" required type="number" />
                  </div>
                  <input className="h-10 w-full rounded-xl border border-border px-3 text-xs" name="expectedCloseOn" type="date" />
                  <input className="h-10 w-full rounded-xl border border-border px-3 text-xs" name="source" placeholder="机会来源" />
                  <textarea className="min-h-16 w-full rounded-xl border border-border px-3 py-2.5 text-xs" name="nextAction" placeholder="下一步行动" />
                  <textarea className="min-h-16 w-full rounded-xl border border-border px-3 py-2.5 text-xs" name="note" placeholder="备注" />
                  <button className="h-10 w-full rounded-xl bg-[#0a385d] text-xs font-medium text-white" type="submit">创建销售机会</button>
                </form>
              </section>
              <section className="rounded-[22px] border border-border/80 bg-white p-5 sm:p-6">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold">新建销售订单</h2>
                    <p className="mt-1 text-[9px] text-muted-foreground">保存交易快照，确认后进入履约</p>
                  </div>
                  <ArrowRight className="size-4 text-primary" />
                </div>
                <SalesOrderBuilder customers={customers} opportunities={opportunityOptions} products={products} />
              </section>
            </div>
          ) : (
            <section className="rounded-[22px] border border-border/80 bg-white p-6 text-center">
              <ShoppingCart className="mx-auto size-8 text-muted-foreground/50" />
              <h2 className="mt-3 text-sm font-medium">当前为销售业务查询视图</h2>
              <p className="mt-2 text-[10px] leading-5 text-muted-foreground">销售、客服和系统管理员可创建销售机会与订单。</p>
            </section>
          )}
        </div>
      </main>
    </WorkflowShell>
  );
}
