"use client";

import { useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import {
  createPurchaseOrderAction,
  createPurchaseRequestAction,
  receivePurchaseOrderAction,
} from "@/features/procurement/server-actions";

export type ProcurementProductOption = {
  id: string;
  code: string;
  name: string;
  specification: string | null;
  procurementPrice: number;
};

type ProductLine = {
  key: string;
  productId: string;
  quantity: string;
  unitPrice: string;
};

function newLine(products: ProcurementProductOption[]): ProductLine {
  const product = products[0];
  return {
    key: crypto.randomUUID(),
    productId: product?.id ?? "",
    quantity: "1",
    unitPrice: product?.procurementPrice ? String(product.procurementPrice) : "",
  };
}

function LineEditor({
  products,
  lines,
  setLines,
  showPrice,
}: {
  products: ProcurementProductOption[];
  lines: ProductLine[];
  setLines: React.Dispatch<React.SetStateAction<ProductLine[]>>;
  showPrice: boolean;
}) {
  const updateLine = (key: string, patch: Partial<ProductLine>) => {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  };
  return (
    <div className="space-y-2">
      {lines.map((line, index) => {
        const amount = Number(line.quantity || 0) * Number(line.unitPrice || 0);
        return (
          <div className={`grid gap-2 rounded-2xl border border-border/75 bg-[#f8faf9] p-3 ${showPrice ? "sm:grid-cols-[1fr_110px_120px_36px]" : "sm:grid-cols-[1fr_120px_36px]"}`} key={line.key}>
            <label className="text-[10px] text-muted-foreground">
              商品 {index + 1}
              <select
                className="mt-1.5 h-10 w-full rounded-xl border border-border bg-white px-3 text-xs"
                onChange={(event) => {
                  const next = products.find((item) => item.id === event.target.value);
                  updateLine(line.key, {
                    productId: event.target.value,
                    unitPrice: next?.procurementPrice ? String(next.procurementPrice) : line.unitPrice,
                  });
                }}
                required
                value={line.productId}
              >
                <option value="">选择产品</option>
                {products.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.code} · {option.name}{option.specification ? ` · ${option.specification}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[10px] text-muted-foreground">
              数量
              <input
                className="mt-1.5 h-10 w-full rounded-xl border border-border bg-white px-3 text-xs"
                min="0.001"
                onChange={(event) => updateLine(line.key, { quantity: event.target.value })}
                required
                step="0.001"
                type="number"
                value={line.quantity}
              />
            </label>
            {showPrice && (
              <label className="text-[10px] text-muted-foreground">
                含税单价
                <input
                  className="mt-1.5 h-10 w-full rounded-xl border border-border bg-white px-3 text-xs"
                  min="0.01"
                  onChange={(event) => updateLine(line.key, { unitPrice: event.target.value })}
                  required
                  step="0.01"
                  type="number"
                  value={line.unitPrice}
                />
                <span className="mt-1 block text-[9px] text-primary">小计 ¥{amount.toFixed(2)}</span>
              </label>
            )}
            <button
              aria-label="删除商品"
              className="mt-5 flex size-9 items-center justify-center rounded-xl border border-border bg-white text-muted-foreground disabled:opacity-35"
              disabled={lines.length === 1}
              onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))}
              type="button"
            >
              <Minus className="size-4" />
            </button>
          </div>
        );
      })}
      <button
        className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-primary/30 px-3 py-2 text-xs font-medium text-primary"
        onClick={() => setLines((current) => [...current, newLine(products)])}
        type="button"
      >
        <Plus className="size-3.5" /> 添加商品
      </button>
    </div>
  );
}

export function PurchaseRequestBuilder({ products }: { products: ProcurementProductOption[] }) {
  const [lines, setLines] = useState<ProductLine[]>(() => [newLine(products)]);
  const items = useMemo(
    () => lines.map((line) => ({ productId: line.productId, quantity: Number(line.quantity) })),
    [lines],
  );
  return (
    <form action={createPurchaseRequestAction} className="space-y-4">
      <input name="items" type="hidden" value={JSON.stringify(items)} />
      <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
        <label className="text-[10px] text-muted-foreground">
          申请主题
          <input className="mt-1.5 h-10 w-full rounded-xl border border-border px-3 text-xs" maxLength={120} name="title" placeholder="例如：8 月餐饮客户备货采购" required />
        </label>
        <label className="text-[10px] text-muted-foreground">
          期望到位日期
          <input className="mt-1.5 h-10 w-full rounded-xl border border-border px-3 text-xs" name="requiredOn" type="date" />
        </label>
      </div>
      <LineEditor lines={lines} products={products} setLines={setLines} showPrice={false} />
      <label className="block text-[10px] text-muted-foreground">
        采购原因
        <textarea className="mt-1.5 min-h-20 w-full rounded-xl border border-border px-3 py-2 text-xs" maxLength={1000} name="reason" placeholder="说明库存、客户订单或经营需要" />
      </label>
      <button className="rounded-xl bg-[#0a385d] px-5 py-2.5 text-xs font-semibold text-white" type="submit">提交采购申请</button>
    </form>
  );
}

export function PurchaseOrderBuilder({
  products,
  suppliers,
  warehouses,
  approvedRequests,
}: {
  products: ProcurementProductOption[];
  suppliers: Array<{ id: string; name: string; supplierNo: string }>;
  warehouses: Array<{ id: string; name: string; code: string }>;
  approvedRequests: Array<{ id: string; requestNo: string; title: string }>;
}) {
  const [lines, setLines] = useState<ProductLine[]>(() => [newLine(products)]);
  const items = useMemo(
    () => lines.map((line) => ({ productId: line.productId, quantity: Number(line.quantity), unitPrice: Number(line.unitPrice) })),
    [lines],
  );
  const total = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(new Date());
  return (
    <form action={createPurchaseOrderAction} className="space-y-4">
      <input name="items" type="hidden" value={JSON.stringify(items)} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <label className="text-[10px] text-muted-foreground">供应商
          <select className="mt-1.5 h-10 w-full rounded-xl border border-border bg-white px-3 text-xs" name="supplierId" required>
            <option value="">选择合作供应商</option>
            {suppliers.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.supplierNo}</option>)}
          </select>
        </label>
        <label className="text-[10px] text-muted-foreground">收货仓库
          <select className="mt-1.5 h-10 w-full rounded-xl border border-border bg-white px-3 text-xs" name="warehouseId" required>
            <option value="">选择仓库</option>
            {warehouses.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.code}</option>)}
          </select>
        </label>
        <label className="text-[10px] text-muted-foreground">订单日期
          <input className="mt-1.5 h-10 w-full rounded-xl border border-border px-3 text-xs" defaultValue={today} name="orderDate" required type="date" />
        </label>
        <label className="text-[10px] text-muted-foreground">预计到货
          <input className="mt-1.5 h-10 w-full rounded-xl border border-border px-3 text-xs" name="expectedArrivalOn" type="date" />
        </label>
      </div>
      <label className="block text-[10px] text-muted-foreground">关联已审批采购申请
        <select className="mt-1.5 h-10 w-full rounded-xl border border-border bg-white px-3 text-xs" name="purchaseRequestId">
          <option value="">不关联</option>
          {approvedRequests.map((item) => <option key={item.id} value={item.id}>{item.requestNo} · {item.title}</option>)}
        </select>
      </label>
      <LineEditor lines={lines} products={products} setLines={setLines} showPrice />
      <div className="rounded-2xl bg-[#edf5f7] px-4 py-3 text-right text-sm font-semibold text-[#0a385d]">订单合计 ¥{total.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}</div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-[10px] text-muted-foreground">付款条件
          <input className="mt-1.5 h-10 w-full rounded-xl border border-border px-3 text-xs" maxLength={500} name="paymentTerms" placeholder="例如：到货验收后 30 天" />
        </label>
        <label className="text-[10px] text-muted-foreground">交付条件
          <input className="mt-1.5 h-10 w-full rounded-xl border border-border px-3 text-xs" maxLength={500} name="deliveryTerms" placeholder="例如：送货至万纬仓" />
        </label>
      </div>
      <label className="block text-[10px] text-muted-foreground">备注
        <textarea className="mt-1.5 min-h-16 w-full rounded-xl border border-border px-3 py-2 text-xs" maxLength={1000} name="note" />
      </label>
      <button className="rounded-xl bg-[#0a385d] px-5 py-2.5 text-xs font-semibold text-white" type="submit">保存采购订单草稿</button>
    </form>
  );
}

type ReceiptLine = {
  purchaseOrderItemId: string;
  productName: string;
  orderedQuantity: number;
  receivedQuantity: number;
  quantity: string;
  productionDate: string;
  shelfLifeMonths: string;
};

export function GoodsReceiptForm({ orderId, orderNo, lines: initialLines }: { orderId: string; orderNo: string; lines: ReceiptLine[] }) {
  const [lines, setLines] = useState(initialLines);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(new Date());
  const payload = lines
    .filter((line) => Number(line.quantity) > 0)
    .map((line) => ({ purchaseOrderItemId: line.purchaseOrderItemId, quantity: Number(line.quantity), productionDate: line.productionDate, shelfLifeMonths: line.shelfLifeMonths }));
  return (
    <form action={receivePurchaseOrderAction} className="space-y-3 rounded-2xl border border-border bg-white p-4">
      <input name="orderId" type="hidden" value={orderId} />
      <input name="items" type="hidden" value={JSON.stringify(payload)} />
      <div className="flex items-center justify-between"><div><div className="text-sm font-semibold text-[#12324a]">{orderNo}</div><div className="text-[10px] text-muted-foreground">登记本次实际到货数量</div></div><span className="rounded-lg bg-[#e8f5f3] px-2 py-1 text-[10px] text-[#087c78]">待入库</span></div>
      {lines.map((line, index) => {
        const outstanding = Math.max(0, line.orderedQuantity - line.receivedQuantity);
        return (
          <div className="grid gap-2 rounded-xl bg-[#f7f9f8] p-3 sm:grid-cols-[1fr_100px_135px_100px]" key={line.purchaseOrderItemId}>
            <div className="text-xs"><div className="font-medium">{line.productName}</div><div className="mt-1 text-[9px] text-muted-foreground">订 {line.orderedQuantity} · 已收 {line.receivedQuantity} · 未收 {outstanding}</div></div>
            <input aria-label={`${line.productName} 本次到货数量`} className="h-9 rounded-lg border border-border px-2 text-xs" max={outstanding} min="0" onChange={(event) => setLines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, quantity: event.target.value } : item))} step="0.001" type="number" value={line.quantity} />
            <input aria-label={`${line.productName} 生产日期`} className="h-9 rounded-lg border border-border px-2 text-xs" onChange={(event) => setLines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, productionDate: event.target.value } : item))} type="date" value={line.productionDate} />
            <input aria-label={`${line.productName} 保质期月数`} className="h-9 rounded-lg border border-border px-2 text-xs" max="120" min="1" onChange={(event) => setLines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, shelfLifeMonths: event.target.value } : item))} placeholder="保质期/月" type="number" value={line.shelfLifeMonths} />
          </div>
        );
      })}
      <div className="grid gap-2 sm:grid-cols-3">
        <input className="h-9 rounded-lg border border-border px-3 text-xs" defaultValue={today} name="receivedOn" required type="date" />
        <input className="h-9 rounded-lg border border-border px-3 text-xs" name="supplierDeliveryNo" placeholder="供应商送货单号" />
        <input className="h-9 rounded-lg border border-border px-3 text-xs" name="note" placeholder="验收备注" />
      </div>
      <button className="rounded-xl bg-[#087c78] px-4 py-2 text-xs font-semibold text-white" type="submit">确认到货并过账</button>
    </form>
  );
}
