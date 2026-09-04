import type { Metadata } from "next";
import { BusinessDataTable } from "@/components/business/business-data-table";
import { CapabilityHero } from "@/components/business/capability-hero";
import { WorkflowShell } from "@/features/approvals/workflow-shell";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import {
  manageLocationAction,
  moveBatchAction,
  saveInventoryPolicyAction,
} from "@/features/business-capabilities/actions";
import { createClient } from "@/lib/supabase/server";
export const metadata: Metadata = { title: "精细库存控制" };
export const dynamic = "force-dynamic";
const input = "h-9 rounded-xl border border-border bg-white px-3 text-[10px]";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; error?: string }>;
}) {
  const [e, p] = await Promise.all([requireCurrentEmployee(), searchParams]);
  const s = await createClient();
  const [{ data: w }, { data: l }, { data: b }, { data: v }, { data: policy }] =
    await Promise.all([
      s.from("warehouses").select("id,code,name").eq("status", "active"),
      s
        .from("warehouse_locations")
        .select("id,warehouse_id,code,name,location_type,warehouses(name)")
        .eq("status", "active"),
      s
        .from("inventory_batches")
        .select(
          "id,lot_key,quantity,unit_cost,expiry_date,location_id,inventory_items(sku,product_name),warehouses(name)",
        )
        .in("status", ["available", "quarantined"])
        .limit(200),
      s.rpc("inventory_valuation_summary", { p_warehouse_id: null }),
      s
        .from("inventory_policies")
        .select("expiry_warning_days,issue_strategy")
        .maybeSingle(),
    ]);
  return (
    <WorkflowShell
      activeItem="仓储管理"
      breadcrumb="供应链 / 库存 / 精细控制"
      currentUser={{ name: e.name, roleLabel: e.title ?? "内部员工" }}
    >
      <main className="mx-auto max-w-[1400px] p-4 sm:p-6 xl:p-8">
        <CapabilityHero
          eyebrow="LOCATION · LOT · FEFO · COST"
          title="精细库存控制"
          description="在现有批次、调拨和盘点之上增加库位、先进先出/先到期先出策略及库存计价。"
        />
        {(p.created || p.error) && (
          <div className="mt-4 rounded-xl border p-3 text-[10px]">
            {p.error ?? p.created}
          </div>
        )}
        <div className="mt-5 grid gap-5 lg:grid-cols-3">
          <form
            action={manageLocationAction}
            className="grid gap-3 rounded-[20px] border border-border bg-white p-5"
          >
            <h2 className="text-sm font-semibold">新增库位</h2>
            <select className={input} name="warehouseId">
              {(w ?? []).map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
            <input
              className={input}
              name="code"
              placeholder="库位编码"
              required
            />
            <input
              className={input}
              name="name"
              placeholder="库位名称"
              required
            />
            <input className={input} name="zone" placeholder="区域" />
            <select className={input} name="locationType">
              <option value="storage">存储位</option>
              <option value="receiving">收货区</option>
              <option value="picking">拣货位</option>
              <option value="quarantine">隔离区</option>
              <option value="shipping">发货区</option>
            </select>
            <button className="h-9 rounded-xl bg-primary text-[10px] text-white">
              保存库位
            </button>
          </form>
          <form
            action={moveBatchAction}
            className="grid gap-3 rounded-[20px] border border-border bg-white p-5"
          >
            <h2 className="text-sm font-semibold">批次移位</h2>
            <select className={input} name="batchId">
              {(b ?? []).map((x) => (
                <option key={x.id} value={x.id}>
                  {x.lot_key}
                </option>
              ))}
            </select>
            <select className={input} name="locationId">
              {(l ?? []).map((x) => (
                <option key={x.id} value={x.id}>
                  {x.code} · {x.name}
                </option>
              ))}
            </select>
            <button className="h-9 rounded-xl bg-primary text-[10px] text-white">
              确认移位
            </button>
          </form>
          <form
            action={saveInventoryPolicyAction}
            className="grid gap-3 rounded-[20px] border border-border bg-white p-5"
          >
            <h2 className="text-sm font-semibold">库存策略</h2>
            <input
              className={input}
              defaultValue={policy?.expiry_warning_days ?? 90}
              name="days"
              type="number"
            />
            <select
              className={input}
              defaultValue={policy?.issue_strategy ?? "fefo"}
              name="strategy"
            >
              <option value="fefo">先到期先出 FEFO</option>
              <option value="fifo">先进先出 FIFO</option>
            </select>
            <button className="h-9 rounded-xl bg-primary text-[10px] text-white">
              保存策略
            </button>
          </form>
        </div>
        <h2 className="mb-3 mt-7 text-sm font-semibold">库存价值</h2>
        <BusinessDataTable
          columns={[
            { key: "warehouse", label: "仓库" },
            { key: "product", label: "商品" },
            { key: "quantity", label: "可用数量", align: "right" },
            { key: "cost", label: "平均成本", align: "right" },
            { key: "value", label: "库存价值", align: "right" },
            { key: "expiring", label: "临期数量", align: "right" },
          ]}
          rows={(v ?? []).map(
            (x: {
              warehouse_id: string;
              warehouse_name: string;
              sku: string;
              product_name: string;
              available_quantity: number;
              average_cost: number;
              inventory_value: number;
              expiring_quantity: number | null;
            }) => ({
              warehouse: x.warehouse_name,
              product: (
                <div>
                  <b>{x.product_name}</b>
                  <div className="font-mono text-[9px]">{x.sku}</div>
                </div>
              ),
              quantity: Number(x.available_quantity),
              cost: `¥${Number(x.average_cost).toFixed(2)}`,
              value: `¥${Number(x.inventory_value).toFixed(2)}`,
              expiring: Number(x.expiring_quantity ?? 0),
            }),
          )}
          rowKeys={(v ?? []).map(
            (x: { warehouse_id: string; sku: string }) =>
              `${x.warehouse_id}:${x.sku}`,
          )}
          total={(v ?? []).length}
          page={1}
          pageSize={Math.max(1, (v ?? []).length)}
          pathname="/inventory/control"
        />
      </main>
    </WorkflowShell>
  );
}
