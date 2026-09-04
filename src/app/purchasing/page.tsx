import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Banknote,
  Boxes,
  ClipboardCheck,
  PackageCheck,
  ShoppingCart,
  Truck,
} from "lucide-react";
import { WorkflowShell } from "@/features/approvals/workflow-shell";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import {
  GoodsReceiptForm,
  ProcurementProductOption,
  PurchaseOrderBuilder,
  PurchaseRequestBuilder,
} from "@/features/procurement/procurement-builders";
import {
  transitionPurchaseOrderAction,
  transitionPurchaseRequestAction,
} from "@/features/procurement/server-actions";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "采购管理 V0.9",
  description: "采购申请、采购订单、到货入库与采购应付闭环",
};

export const dynamic = "force-dynamic";

type RequestRow = {
  id: string;
  request_no: string;
  requester_employee_id: string;
  title: string;
  required_on: string | null;
  status: string;
  estimated_amount: number;
  submitted_at: string;
  requester: { name: string } | { name: string }[] | null;
  items: Array<{ id: string; product_name: string; quantity: number; unit: string }>;
};

type OrderRow = {
  id: string;
  order_no: string;
  status: string;
  order_date: string;
  expected_arrival_on: string | null;
  total_amount: number;
  supplier: { name: string } | { name: string }[] | null;
  warehouse: { name: string } | { name: string }[] | null;
  buyer: { name: string } | { name: string }[] | null;
  items: Array<{
    id: string;
    product_name: string;
    quantity: number;
    received_quantity: number;
    unit: string;
    unit_price: number;
  }>;
};

type ReceiptRow = {
  id: string;
  receipt_no: string;
  received_on: string;
  total_amount: number;
  supplier: { name: string } | { name: string }[] | null;
  warehouse: { name: string } | { name: string }[] | null;
};

type WarehouseQueueOrder = {
  id: string;
  orderNo: string;
  status: string;
  orderDate: string;
  expectedArrivalOn: string | null;
  supplierName: string;
  warehouseName: string;
  buyerName: string;
  items: Array<{
    id: string;
    productName: string;
    quantity: number;
    receivedQuantity: number;
    unit: string;
  }>;
};

const requestStatus: Record<string, [string, string]> = {
  submitted: ["待审批", "bg-[#fff4df] text-[#93621e]"],
  approved: ["已通过", "bg-[#e8f5f3] text-[#087c78]"],
  rejected: ["已驳回", "bg-[#fff0f0] text-[#a34f4f]"],
  converted: ["已转订单", "bg-[#eaf1fb] text-[#3c6190]"],
  cancelled: ["已撤回", "bg-[#f0f2f2] text-muted-foreground"],
};

const orderStatus: Record<string, [string, string]> = {
  draft: ["草稿", "bg-[#f0f2f2] text-muted-foreground"],
  confirmed: ["待到货", "bg-[#fff4df] text-[#93621e]"],
  partial_received: ["部分到货", "bg-[#eaf1fb] text-[#3c6190]"],
  received: ["已入库", "bg-[#e8f5f3] text-[#087c78]"],
  cancelled: ["已取消", "bg-[#fff0f0] text-[#a34f4f]"],
};

function one<T>(value: T | T[] | null) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function money(value: number) {
  return new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY", maximumFractionDigits: 2 }).format(Number(value ?? 0));
}

function date(value: string | null) {
  return value ? new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai" }).format(new Date(`${value}T00:00:00+08:00`)) : "未设置";
}

export default async function PurchasingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const employee = await requireCurrentEmployee();
  const feedback = await searchParams;
  const supabase = await createClient();
  const [
    supplierPermission,
    inventoryPermission,
    productsResult,
    suppliersResult,
    warehousesResult,
    requestsResult,
    ordersResult,
    warehouseQueueResult,
    receiptsResult,
    payablesResult,
  ] = await Promise.all([
    supabase.rpc("can_manage_suppliers"),
    supabase.rpc("can_manage_inventory"),
    supabase.from("products").select("id, code, name, specification, prices:product_prices(price_type, amount_cny, status)").eq("status", "active").order("code").limit(300),
    supabase.from("suppliers").select("id, supplier_no, name").eq("cooperation_status", "active").order("name").limit(300),
    supabase.from("warehouses").select("id, code, name").eq("status", "active").order("code"),
    supabase.from("purchase_requests").select("id, request_no, requester_employee_id, title, required_on, status, estimated_amount, submitted_at, requester:employees!purchase_requests_requester_employee_id_fkey(name), items:purchase_request_items(id, product_name, quantity, unit)").order("submitted_at", { ascending: false }).limit(100),
    supabase.from("purchase_orders").select("id, order_no, status, order_date, expected_arrival_on, total_amount, supplier:suppliers(name), warehouse:warehouses(name), buyer:employees!purchase_orders_buyer_employee_id_fkey(name), items:purchase_order_items(id, product_name, quantity, received_quantity, unit, unit_price)").order("created_at", { ascending: false }).limit(100),
    supabase.rpc("warehouse_receiving_queue"),
    supabase.from("goods_receipts").select("id, receipt_no, received_on, total_amount, supplier:suppliers(name), warehouse:warehouses(name)").order("created_at", { ascending: false }).limit(50),
    supabase.from("finance_documents").select("id, total_amount, settled_amount, status").eq("document_type", "payable").eq("source_type", "purchase").neq("status", "void").limit(500),
  ]);

  const migrationMissing = [requestsResult, ordersResult, receiptsResult].some((result) => result.error?.code === "42P01" || result.error?.code === "PGRST205");
  const canManage = Boolean(supplierPermission.data);
  const canReceive = Boolean(inventoryPermission.data);
  const canFinance = employee.roleCodes.includes("finance");
  const products: ProcurementProductOption[] = (productsResult.data ?? []).map((product) => {
    const prices = (product.prices ?? []) as Array<{ price_type: string; amount_cny: number; status: string }>;
    const procurement = prices.find((price) => price.price_type === "procurement" && price.status === "active");
    return { id: product.id, code: product.code, name: product.name, specification: product.specification, procurementPrice: Number(procurement?.amount_cny ?? 0) };
  });
  const requests = (requestsResult.data ?? []) as unknown as RequestRow[];
  const costVisibleOrders = (ordersResult.data ?? []) as unknown as OrderRow[];
  const warehouseQueue = (warehouseQueueResult.data ?? []) as WarehouseQueueOrder[];
  const warehouseOrders: OrderRow[] = warehouseQueue.map((order) => ({
    id: order.id,
    order_no: order.orderNo,
    status: order.status,
    order_date: order.orderDate,
    expected_arrival_on: order.expectedArrivalOn,
    total_amount: 0,
    supplier: { name: order.supplierName },
    warehouse: { name: order.warehouseName },
    buyer: { name: order.buyerName },
    items: order.items.map((item) => ({
      id: item.id,
      product_name: item.productName,
      quantity: item.quantity,
      received_quantity: item.receivedQuantity,
      unit: item.unit,
      unit_price: 0,
    })),
  }));
  const orderMap = new Map(costVisibleOrders.map((order) => [order.id, order]));
  for (const order of warehouseOrders) {
    if (!orderMap.has(order.id)) orderMap.set(order.id, order);
  }
  const orders = [...orderMap.values()];
  const receipts = (receiptsResult.data ?? []) as unknown as ReceiptRow[];
  const payables = payablesResult.data ?? [];
  const payableOutstanding = payables.reduce((sum, row) => sum + Number(row.total_amount) - Number(row.settled_amount), 0);
  const approvedRequests = requests.filter((item) => item.status === "approved");
  const receivingOrders = orders.filter((item) => ["confirmed", "partial_received"].includes(item.status));

  return (
    <WorkflowShell
      activeItem="采购管理"
      breadcrumb="供应链 / 采购管理"
      currentUser={{ name: employee.name, roleLabel: employee.title ?? "内部员工" }}
    >
      <main className="mx-auto max-w-[1500px] p-4 sm:p-6 xl:p-8">
        <section id="overview" className="relative overflow-hidden rounded-[26px] bg-[linear-gradient(135deg,#082d4c_0%,#0a4a64_58%,#087c78_100%)] px-6 py-8 text-white sm:px-8">
          <div className="absolute -right-20 -top-24 size-80 rounded-full border border-white/10" />
          <ShoppingCart className="absolute right-12 top-1/2 hidden size-40 -translate-y-1/2 text-white/[0.06] sm:block" />
          <div className="relative max-w-3xl">
            <div className="text-[10px] tracking-[0.2em] text-[#73d8d5]">V0.9 · PROCUREMENT & FINANCE LOOP</div>
            <h1 className="mt-3 text-2xl font-semibold tracking-[-0.03em] sm:text-[30px]">采购与供应链闭环</h1>
            <p className="mt-3 text-sm leading-7 text-white/60">从内部采购需求出发，连接合作供应商、采购订单、批次入库、采购应付和银行付款核销。应付按实际到货金额生成，不提前确认未履约采购。</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <a className="rounded-xl bg-white px-4 py-2 text-xs font-semibold text-[#0a385d]" href="#requests">发起采购申请</a>
              <Link className="rounded-xl border border-white/25 px-4 py-2 text-xs font-semibold" href="/purchasing/control">询价 · 质检 · 三单匹配</Link>
              <Link className="rounded-xl border border-white/25 px-4 py-2 text-xs font-semibold" href="/finance/bank-reconciliation">银行核销 <ArrowRight className="ml-1 inline size-3" /></Link>
            </div>
          </div>
        </section>

        {(feedback.error || feedback.created) && <div className={`mt-4 rounded-xl border px-4 py-3 text-xs ${feedback.error ? "border-[#ead3d3] bg-[#fff7f7] text-[#914949]" : "border-[#cce5db] bg-[#f2fbf6] text-[#177355]"}`}>{feedback.error ?? feedback.created}</div>}
        {migrationMissing && <div className="mt-4 rounded-xl border border-[#ead5a8] bg-[#fff9ea] px-4 py-3 text-xs text-[#8b6422]">V0.9 数据库迁移尚未执行。页面结构已就绪，执行新迁移后将切换为真实采购数据。</div>}

        <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {[
            { label: "待审批申请", value: requests.filter((item) => item.status === "submitted").length, icon: ClipboardCheck, note: "员工采购需求" },
            { label: "执行中订单", value: orders.filter((item) => ["confirmed", "partial_received"].includes(item.status)).length, icon: Truck, note: "等待到货或部分到货" },
            { label: "累计入库单", value: receipts.length, icon: PackageCheck, note: "已过账到货记录" },
            { label: "采购应付余额", value: money(payableOutstanding), icon: Banknote, note: `${payables.length} 笔采购应付` },
            { label: "有效产品", value: products.length, icon: Boxes, note: "来自产品中心" },
          ].map(({ label, value, icon: Icon, note }) => (
            <div className="rounded-[20px] border border-border/70 bg-white p-4 shadow-[0_8px_26px_rgba(23,50,62,0.04)]" key={label}>
              <div className="flex items-center justify-between"><span className="text-[10px] text-muted-foreground">{label}</span><Icon className="size-4 text-[#087c78]" /></div>
              <div className="mt-3 text-xl font-semibold text-[#12324a]">{value}</div>
              <div className="mt-1 text-[9px] text-muted-foreground">{note}</div>
            </div>
          ))}
        </section>

        <section id="requests" className="mt-6 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[22px] border border-border/70 bg-white p-5">
            <div className="mb-4"><div className="text-sm font-semibold text-[#12324a]">发起采购申请</div><div className="mt-1 text-[10px] text-muted-foreground">所有在职员工均可提交，采购负责人审批后转采购订单。</div></div>
            <PurchaseRequestBuilder products={products} />
          </div>
          <div className="rounded-[22px] border border-border/70 bg-white p-5">
            <div className="mb-4 flex items-center justify-between"><div><div className="text-sm font-semibold text-[#12324a]">采购申请</div><div className="mt-1 text-[10px] text-muted-foreground">我的申请与权限内待审批申请</div></div><span className="text-[10px] text-muted-foreground">{requests.length} 条</span></div>
            <div className="space-y-2">
              {requests.length ? requests.map((request) => {
                const status = requestStatus[request.status] ?? [request.status, "bg-[#f0f2f2] text-muted-foreground"];
                return <div className="rounded-2xl border border-border/65 p-4" key={request.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-xs font-semibold text-[#12324a]">{request.title}</div><div className="mt-1 text-[9px] text-muted-foreground">{request.request_no} · {one(request.requester)?.name ?? "员工"} · 需用 {date(request.required_on)}</div></div><span className={`rounded-lg px-2 py-1 text-[9px] ${status[1]}`}>{status[0]}</span></div>
                  <div className="mt-3 text-[10px] text-muted-foreground">{request.items.map((item) => `${item.product_name} × ${item.quantity}`).join("；") || "暂无商品明细"}</div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-semibold text-[#0a385d]">{Number(request.estimated_amount) > 0 ? `预计 ${money(request.estimated_amount)}` : "待采购核价"}</span><div className="flex gap-2">
                    {request.status === "submitted" && canManage && <><form action={transitionPurchaseRequestAction}><input name="requestId" type="hidden" value={request.id} /><input name="targetStatus" type="hidden" value="approved" /><button className="rounded-lg bg-[#e8f5f3] px-3 py-1.5 text-[10px] font-medium text-[#087c78]" type="submit">通过</button></form><form action={transitionPurchaseRequestAction} className="flex gap-1"><input name="requestId" type="hidden" value={request.id} /><input name="targetStatus" type="hidden" value="rejected" /><input className="w-28 rounded-lg border border-border px-2 text-[9px]" name="note" placeholder="驳回原因" required /><button className="rounded-lg bg-[#fff0f0] px-3 py-1.5 text-[10px] text-[#a34f4f]" type="submit">驳回</button></form></>}
                    {request.status === "submitted" && request.requester_employee_id === employee.id && <form action={transitionPurchaseRequestAction}><input name="requestId" type="hidden" value={request.id} /><input name="targetStatus" type="hidden" value="cancelled" /><input name="note" type="hidden" value="申请人撤回" /><button className="rounded-lg border border-border px-3 py-1.5 text-[10px] text-muted-foreground" type="submit">撤回</button></form>}
                  </div></div>
                </div>;
              }) : <div className="rounded-2xl bg-[#f7f9f8] px-4 py-10 text-center text-xs text-muted-foreground">暂无采购申请</div>}
            </div>
          </div>
        </section>

        {canManage && <section id="orders" className="mt-6 rounded-[22px] border border-border/70 bg-white p-5"><div className="mb-4"><div className="text-sm font-semibold text-[#12324a]">创建采购订单</div><div className="mt-1 text-[10px] text-muted-foreground">采购价默认取产品中心有效采购价，仍可按本次合同议价调整。</div></div><PurchaseOrderBuilder approvedRequests={approvedRequests.map((item) => ({ id: item.id, requestNo: item.request_no, title: item.title }))} products={products} suppliers={(suppliersResult.data ?? []).map((item) => ({ id: item.id, name: item.name, supplierNo: item.supplier_no }))} warehouses={(warehousesResult.data ?? []).map((item) => ({ id: item.id, name: item.name, code: item.code }))} /></section>}

        <section className="mt-6 rounded-[22px] border border-border/70 bg-white p-5">
          <div className="mb-4 flex items-center justify-between"><div><div className="text-sm font-semibold text-[#12324a]">采购订单执行</div><div className="mt-1 text-[10px] text-muted-foreground">确认订单后由仓储按实际到货办理分批入库。</div></div><span className="text-[10px] text-muted-foreground">{orders.length} 单</span></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-xs"><thead><tr className="border-b border-border text-[9px] text-muted-foreground"><th className="pb-3 font-medium">采购订单</th><th className="pb-3 font-medium">供应商 / 仓库</th><th className="pb-3 font-medium">日期</th><th className="pb-3 font-medium">履约</th><th className="pb-3 text-right font-medium">金额</th><th className="pb-3 text-right font-medium">操作</th></tr></thead><tbody>
            {orders.map((order) => { const status = orderStatus[order.status] ?? [order.status, "bg-[#f0f2f2]"]; const ordered = order.items.reduce((sum, item) => sum + Number(item.quantity), 0); const received = order.items.reduce((sum, item) => sum + Number(item.received_quantity), 0); return <tr className="border-b border-border/60 last:border-0" key={order.id}><td className="py-3"><div className="font-medium text-[#12324a]">{order.order_no}</div><div className="mt-1 text-[9px] text-muted-foreground">采购：{one(order.buyer)?.name ?? "未指定"}</div></td><td className="py-3"><div>{one(order.supplier)?.name ?? "供应商"}</div><div className="mt-1 text-[9px] text-muted-foreground">入库：{one(order.warehouse)?.name ?? "仓库"}</div></td><td className="py-3"><div>{date(order.order_date)}</div><div className="mt-1 text-[9px] text-muted-foreground">预计 {date(order.expected_arrival_on)}</div></td><td className="py-3"><span className={`rounded-lg px-2 py-1 text-[9px] ${status[1]}`}>{status[0]}</span><div className="mt-2 text-[9px] text-muted-foreground">已收 {received} / {ordered}</div></td><td className="py-3 text-right font-semibold">{money(order.total_amount)}</td><td className="py-3"><div className="flex justify-end gap-2">{order.status === "draft" && canManage && <><form action={transitionPurchaseOrderAction}><input name="orderId" type="hidden" value={order.id} /><input name="targetStatus" type="hidden" value="confirmed" /><button className="rounded-lg bg-[#e8f5f3] px-3 py-1.5 text-[10px] text-[#087c78]" type="submit">确认</button></form><form action={transitionPurchaseOrderAction}><input name="orderId" type="hidden" value={order.id} /><input name="targetStatus" type="hidden" value="cancelled" /><input name="note" type="hidden" value="采购负责人取消" /><button className="rounded-lg bg-[#fff0f0] px-3 py-1.5 text-[10px] text-[#a34f4f]" type="submit">取消</button></form></>}</div></td></tr>; })}
          </tbody></table>{!orders.length && <div className="py-12 text-center text-xs text-muted-foreground">暂无采购订单</div>}</div>
        </section>

        <section id="receiving" className="mt-6 grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <div><div className="mb-3"><div className="text-sm font-semibold text-[#12324a]">待到货入库</div><div className="mt-1 text-[10px] text-muted-foreground">过账时同步库存批次、入库流水和采购应付。</div></div><div className="space-y-3">{canReceive && receivingOrders.length ? receivingOrders.map((order) => <GoodsReceiptForm key={order.id} orderId={order.id} orderNo={order.order_no} lines={order.items.filter((item) => Number(item.received_quantity) < Number(item.quantity)).map((item) => ({ purchaseOrderItemId: item.id, productName: item.product_name, orderedQuantity: Number(item.quantity), receivedQuantity: Number(item.received_quantity), quantity: String(Number(item.quantity) - Number(item.received_quantity)), productionDate: "", shelfLifeMonths: "" }))} />) : <div className="rounded-[22px] border border-border/70 bg-white px-5 py-12 text-center text-xs text-muted-foreground">{canReceive ? "暂无待到货订单" : "仅仓储人员可办理到货入库"}</div>}</div></div>
          <div className="rounded-[22px] border border-border/70 bg-white p-5"><div className="mb-4"><div className="text-sm font-semibold text-[#12324a]">最近入库单</div><div className="mt-1 text-[10px] text-muted-foreground">每张入库单对应一笔实际采购应付。</div></div><div className="space-y-2">{receipts.length ? receipts.map((receipt) => <div className="flex items-center justify-between rounded-xl bg-[#f7f9f8] px-3 py-3" key={receipt.id}><div><div className="text-xs font-medium">{receipt.receipt_no}</div><div className="mt-1 text-[9px] text-muted-foreground">{one(receipt.supplier)?.name} · {one(receipt.warehouse)?.name} · {date(receipt.received_on)}</div></div><div className="text-xs font-semibold text-[#087c78]">{money(receipt.total_amount)}</div></div>) : <div className="py-10 text-center text-xs text-muted-foreground">暂无入库单</div>}</div>{canFinance && <Link className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-[#087c78]" href="/finance?book=payable#documents">查看采购应付 <ArrowRight className="size-3" /></Link>}</div>
        </section>
      </main>
    </WorkflowShell>
  );
}
