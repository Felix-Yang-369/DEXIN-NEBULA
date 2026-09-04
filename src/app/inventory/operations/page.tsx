import type { Metadata } from "next";
import { ArrowRightLeft, ClipboardCheck, PackageCheck, Route, Truck } from "lucide-react";
import { WorkflowShell } from "@/features/approvals/workflow-shell";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import {
  completeOutbound,
  completeStocktake,
  createOutbound,
  executeTransfer,
  updateDelivery,
} from "@/features/inventory/execution-actions";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "仓储作业", description: "出库、调拨、盘点与配送执行" };
export const dynamic = "force-dynamic";

const input = "mt-1.5 h-10 w-full rounded-md border border-border bg-white/90 px-3 text-xs outline-none focus:border-border";
const area = "mt-1.5 min-h-20 w-full rounded-md border border-border bg-white/90 px-3 py-2.5 text-xs outline-none focus:border-border";
const card = "rounded-md border border-border bg-card p-5";
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(new Date());

type Inventory = { id:string; warehouse_id:string; sku:string; product_name:string; unit:string; quantity:number; available_quantity:number; warehouses:{name:string}|{name:string}[]|null };
type Warehouse = { id:string; name:string; code:string };

function relation<T>(value:T|T[]|null){ return Array.isArray(value) ? value[0] ?? null : value; }
function number(value:number){ return new Intl.NumberFormat("zh-CN",{maximumFractionDigits:3}).format(Number(value)); }
function statusLabel(value:string){ return ({draft:"待执行",completed:"已完成",planned:"待配送",dispatched:"配送中",delivered:"已送达",exception:"异常"} as Record<string,string>)[value] ?? value; }

export default async function InventoryOperationsPage({ searchParams }:{ searchParams:Promise<{created?:string;error?:string}> }){
  const employee=await requireCurrentEmployee();
  const feedback=await searchParams;
  const supabase=await createClient();
  const [warehouseResult,itemResult,outboundResult,transferResult,stocktakeResult,deliveryResult]=await Promise.all([
    supabase.from("warehouses").select("id,name,code").eq("status","active").order("name"),
    supabase.from("inventory_items").select("id,warehouse_id,sku,product_name,unit,quantity,available_quantity,warehouses(name)").eq("status","active").order("product_name"),
    supabase.from("inventory_outbound_orders").select("id,outbound_no,status,recipient_name,requested_on,created_at,warehouses(name)").order("created_at",{ascending:false}).limit(12),
    supabase.from("inventory_transfers").select("id,transfer_no,quantity,transferred_on,created_at").order("created_at",{ascending:false}).limit(8),
    supabase.from("inventory_stocktakes").select("id,stocktake_no,total_lines,difference_lines,counted_on,created_at").order("created_at",{ascending:false}).limit(8),
    supabase.from("delivery_records").select("id,delivery_no,status,carrier_name,driver_name,vehicle_no,created_at,inventory_outbound_orders(outbound_no,recipient_name,delivery_address)").order("created_at",{ascending:false}).limit(12),
  ]);
  const warehouses=(warehouseResult.data??[]) as Warehouse[];
  const items=(itemResult.data??[]) as Inventory[];
  const outbounds=(outboundResult.data??[]) as Array<Record<string,unknown>>;
  const transfers=(transferResult.data??[]) as Array<Record<string,unknown>>;
  const stocktakes=(stocktakeResult.data??[]) as Array<Record<string,unknown>>;
  const deliveries=(deliveryResult.data??[]) as Array<Record<string,unknown>>;
  const migrationMissing=[outboundResult,transferResult,stocktakeResult,deliveryResult].some(result=>result.error);

  return <WorkflowShell activeItem="仓储管理" breadcrumb="供应链 / 仓储管理 / 仓储作业" currentUser={{name:employee.name,roleLabel:employee.roleCodes.join(" · ")}}>
    <main className="mx-auto max-w-[1440px] p-4 sm:p-6 xl:p-8">
      <section className="ui-page-header">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div><div className="text-xs tracking-[.16em] text-muted-foreground">WMS · WAREHOUSE EXECUTION</div><h1 className="mt-3 text-3xl font-semibold tracking-[-.04em]">仓储执行中心</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-white/68">将出库、仓间调拨、盘点差异与末端配送纳入同一套库存流水和审计链路。</p></div>
          <a className="inline-flex h-10 items-center justify-center rounded-md border border-white/20 bg-white/10 px-5 text-xs backdrop-blur" href="/inventory">返回库存总览</a>
        </div>
      </section>
      {(feedback.created||feedback.error||migrationMissing)&&<div className={`mt-5 rounded-lg border px-4 py-3 text-xs ${feedback.error||migrationMissing?"border-red-200 bg-red-50 text-red-700":"border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{feedback.error??(migrationMissing?"仓储执行数据库升级尚未完成，请先执行最新迁移。":feedback.created)}</div>}

      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        <section className={card}><Header icon={<PackageCheck/>} title="创建出库单" note="先保存单据，确认后按先到期先出扣减批次库存"/>
          <form action={createOutbound} className="mt-5 grid gap-3 sm:grid-cols-2">
            <Field label="仓库"><select className={input} name="warehouseId" required>{warehouses.map(x=><option key={x.id} value={x.id}>{x.code} · {x.name}</option>)}</select></Field>
            <Field label="业务来源"><select className={input} name="sourceType"><option value="manual">手工出库</option><option value="sales">销售订单</option><option value="return_to_supplier">采购退货</option></select></Field>
            <Field label="库存商品"><select className={input} name="inventoryItemId" required>{items.map(x=><option key={x.id} value={x.id}>{x.sku} · {x.product_name}（可用 {number(x.available_quantity)}）</option>)}</select></Field>
            <Field label="数量"><input className={input} name="quantity" min=".001" step=".001" type="number" required/></Field>
            <Field label="来源单号"><input className={input} name="sourceNo" placeholder="销售单或退货单号"/></Field>
            <Field label="计划日期"><input className={input} name="requestedOn" type="date" defaultValue={today}/></Field>
            <Field label="收货人"><input className={input} name="recipientName"/></Field>
            <Field label="联系电话"><input className={input} name="recipientPhone"/></Field>
            <label className="text-xs text-foreground sm:col-span-2">配送地址<input className={input} name="deliveryAddress"/></label>
            <label className="text-xs text-foreground sm:col-span-2">备注<textarea className={area} name="note"/></label>
            <button className="h-10 rounded-md bg-primary text-xs font-medium text-white sm:col-span-2">保存出库单</button>
          </form>
        </section>

        <section className={card}><Header icon={<ArrowRightLeft/>} title="仓间调拨" note="同一事务完成来源仓出库与目标仓入库"/>
          <form action={executeTransfer} className="mt-5 grid gap-3 sm:grid-cols-2">
            <Field label="来源库存"><select className={input} name="sourceItemId" required>{items.map(x=><option key={x.id} value={x.id}>{relation(x.warehouses)?.name} · {x.product_name}（{number(x.available_quantity)}）</option>)}</select></Field>
            <Field label="目标仓库"><select className={input} name="destinationWarehouseId" required>{warehouses.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
            <Field label="调拨数量"><input className={input} name="quantity" min=".001" step=".001" type="number" required/></Field>
            <Field label="调拨日期"><input className={input} name="transferredOn" type="date" defaultValue={today} required/></Field>
            <label className="text-xs text-foreground sm:col-span-2">调拨说明<textarea className={area} name="note"/></label>
            <button className="h-10 rounded-md bg-primary text-xs font-medium text-white sm:col-span-2">确认调拨</button>
          </form>
        </section>

        <section className={card}><Header icon={<ClipboardCheck/>} title="库存盘点" note="记录系统数、实盘数和差异，自动生成盘盈盘亏流水"/>
          <form action={completeStocktake} className="mt-5 grid gap-3 sm:grid-cols-2">
            <Field label="盘点仓库"><select className={input} name="warehouseId" required>{warehouses.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
            <Field label="盘点日期"><input className={input} name="countedOn" type="date" defaultValue={today} required/></Field>
            <Field label="盘点商品"><select className={input} name="inventoryItemId" required>{items.map(x=><option key={x.id} value={x.id}>{x.product_name}（账面 {number(x.quantity)}）</option>)}</select></Field>
            <Field label="实盘数量"><input className={input} name="countedQuantity" min="0" step=".001" type="number" required/></Field>
            <label className="text-xs text-foreground sm:col-span-2">盘点说明<textarea className={area} name="note"/></label>
            <button className="h-10 rounded-md bg-primary text-xs font-medium text-white sm:col-span-2">完成盘点并调整库存</button>
          </form>
        </section>

        <section className={card}><Header icon={<Truck/>} title="配送状态" note="出库完成后自动生成配送单"/>
          <div className="mt-5 space-y-3">{deliveries.length===0?<Empty text="暂无配送记录"/>:deliveries.map(row=><form action={updateDelivery} className="rounded-lg border border-border bg-white/75 p-4" key={String(row.id)}>
            <input type="hidden" name="deliveryId" value={String(row.id)}/><div className="flex items-center justify-between"><div className="font-mono text-xs font-semibold text-foreground">{String(row.delivery_no)}</div><span className="rounded-full bg-muted px-2.5 py-1 text-xs text-foreground">{statusLabel(String(row.status))}</span></div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3"><input className={input} name="carrierName" placeholder="承运商" defaultValue={String(row.carrier_name??"")}/><input className={input} name="driverName" placeholder="司机" defaultValue={String(row.driver_name??"")}/><input className={input} name="vehicleNo" placeholder="车牌号" defaultValue={String(row.vehicle_no??"")}/></div>
            <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto]"><input className={input} name="driverPhone" placeholder="司机电话"/><select className={input} name="status" defaultValue={String(row.status)}><option value="planned">待配送</option><option value="dispatched">配送中</option><option value="delivered">已送达</option><option value="exception">异常</option></select><button className="mt-1.5 rounded-md border border-border px-4 text-xs text-foreground">更新</button></div><input className={input} name="exceptionNote" placeholder="异常时填写说明"/>
          </form>)}</div>
        </section>
      </div>

      <section className={`${card} mt-5`}><Header icon={<Route/>} title="近期仓储单据" note="出库、调拨和盘点统一留痕"/>
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <Ledger title="出库单" rows={outbounds} numberKey="outbound_no" statusKey="status" action={completeOutbound}/>
          <Ledger title="调拨单" rows={transfers} numberKey="transfer_no"/>
          <Ledger title="盘点单" rows={stocktakes} numberKey="stocktake_no"/>
        </div>
      </section>
    </main>
  </WorkflowShell>;
}

function Header({icon,title,note}:{icon:React.ReactNode;title:string;note:string}){return <div className="flex items-start justify-between gap-4"><div><h2 className="text-base font-semibold text-foreground">{title}</h2><p className="mt-1 text-xs text-foreground">{note}</p></div><div className="grid size-10 place-items-center rounded-md bg-muted text-foreground [&_svg]:size-5">{icon}</div></div>}
function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="text-xs text-foreground">{label}{children}</label>}
function Empty({text}:{text:string}){return <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-foreground">{text}</div>}
function Ledger({title,rows,numberKey,statusKey,action}:{title:string;rows:Array<Record<string,unknown>>;numberKey:string;statusKey?:string;action?:(formData:FormData)=>Promise<void>}){return <div><div className="mb-3 text-xs font-semibold text-foreground">{title}</div><div className="space-y-2">{rows.length===0?<Empty text={`暂无${title}`}/>:rows.map(row=><div className="flex items-center justify-between gap-3 rounded-md border border-border bg-white/72 px-3 py-3" key={String(row.id)}><div><div className="font-mono text-xs font-semibold text-foreground">{String(row[numberKey])}</div>{statusKey&&<div className="mt-1 text-xs text-foreground">{statusLabel(String(row[statusKey]))}</div>}</div>{action&&row.status==="draft"&&<form action={action}><input type="hidden" name="outboundId" value={String(row.id)}/><button className="rounded-lg bg-muted px-3 py-2 text-xs font-medium text-foreground">确认出库</button></form>}</div>)}</div></div>}
