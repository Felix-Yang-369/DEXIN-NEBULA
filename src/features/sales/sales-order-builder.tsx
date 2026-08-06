"use client";

import { useMemo, useState } from "react";
import { CirclePlus, ShoppingCart, Trash2 } from "lucide-react";
import { createSalesOrderAction } from "@/features/sales/server-actions";

type PriceType = "retail" | "group" | "dropship";

export type SalesCustomerOption = {
  id: string;
  customerNo: string;
  name: string;
  level: string;
  legalEntities: Array<{ id: string; legalName: string; isDefault: boolean }>;
};

export type SalesOpportunityOption = {
  id: string;
  customerId: string;
  opportunityNo: string;
  title: string;
};

export type SalesProductOption = {
  id: string;
  code: string;
  name: string;
  specification: string | null;
  prices: Partial<Record<PriceType, number>>;
};

type OrderLine = { key: number; productId: string; quantity: number };

const priceLabels: Record<PriceType, string> = {
  retail: "零售价",
  group: "团购价",
  dropship: "代发价",
};

function money(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    maximumFractionDigits: 2,
  }).format(value);
}

export function SalesOrderBuilder({
  customers,
  opportunities,
  products,
}: {
  customers: SalesCustomerOption[];
  opportunities: SalesOpportunityOption[];
  products: SalesProductOption[];
}) {
  const [customerId, setCustomerId] = useState("");
  const [priceType, setPriceType] = useState<PriceType>("group");
  const [lines, setLines] = useState<OrderLine[]>([
    { key: 1, productId: "", quantity: 1 },
  ]);
  const [nextKey, setNextKey] = useState(2);

  const customer = customers.find((item) => item.id === customerId);
  const availableProducts = useMemo(
    () => products.filter((product) => product.prices[priceType] !== undefined),
    [priceType, products],
  );
  const customerOpportunities = opportunities.filter(
    (opportunity) => opportunity.customerId === customerId,
  );
  const total = lines.reduce((sum, line) => {
    const product = products.find((item) => item.id === line.productId);
    return sum + (product?.prices[priceType] ?? 0) * line.quantity;
  }, 0);
  const serializedItems = JSON.stringify(
    lines
      .filter((line) => line.productId && line.quantity > 0)
      .map((line) => ({ productId: line.productId, quantity: line.quantity })),
  );
  const today = new Date().toISOString().slice(0, 10);

  function updateLine(key: number, patch: Partial<OrderLine>) {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  }

  function removeLine(key: number) {
    setLines((current) =>
      current.length === 1
        ? [{ key: current[0].key, productId: "", quantity: 1 }]
        : current.filter((line) => line.key !== key),
    );
  }

  return (
    <form action={createSalesOrderAction} className="space-y-4">
      <input name="items" type="hidden" value={serializedItems} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-[10px] text-muted-foreground">
          业务客户
          <select
            className="mt-1.5 h-10 w-full rounded-xl border border-border bg-white px-3 text-xs outline-none focus:border-primary/45"
            name="customerId"
            onChange={(event) => setCustomerId(event.target.value)}
            required
            value={customerId}
          >
            <option value="">选择客户</option>
            {customers.map((option) => (
              <option key={option.id} value={option.id}>
                {option.level}级 · {option.name} · {option.customerNo}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[10px] text-muted-foreground">
          交易法律实体
          <select
            className="mt-1.5 h-10 w-full rounded-xl border border-border bg-white px-3 text-xs outline-none focus:border-primary/45"
            defaultValue=""
            name="legalEntityId"
            required
          >
            <option value="">选择交易法律实体</option>
            {customer?.legalEntities.map((entity) => (
              <option key={entity.id} value={entity.id}>
                {entity.isDefault ? "默认 · " : ""}
                {entity.legalName}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-[10px] text-muted-foreground">
          关联销售机会
          <select
            className="mt-1.5 h-10 w-full rounded-xl border border-border bg-white px-3 text-xs outline-none focus:border-primary/45"
            name="opportunityId"
          >
            <option value="">不关联</option>
            {customerOpportunities.map((opportunity) => (
              <option key={opportunity.id} value={opportunity.id}>
                {opportunity.opportunityNo} · {opportunity.title}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[10px] text-muted-foreground">
          订单日期
          <input
            className="mt-1.5 h-10 w-full rounded-xl border border-border px-3 text-xs outline-none focus:border-primary/45"
            defaultValue={today}
            name="orderDate"
            required
            type="date"
          />
        </label>
        <label className="text-[10px] text-muted-foreground">
          要求交付
          <input
            className="mt-1.5 h-10 w-full rounded-xl border border-border px-3 text-xs outline-none focus:border-primary/45"
            min={today}
            name="requestedDeliveryOn"
            type="date"
          />
        </label>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {(Object.keys(priceLabels) as PriceType[]).map((type) => (
          <label
            className={`cursor-pointer rounded-xl border px-3 py-2.5 text-xs transition ${
              priceType === type
                ? "border-[#18afb3]/35 bg-[#e9f8f8] font-medium text-[#0d6475]"
                : "border-border bg-white text-muted-foreground"
            }`}
            key={type}
          >
            <input
              checked={priceType === type}
              className="sr-only"
              name="priceType"
              onChange={() => setPriceType(type)}
              type="radio"
              value={type}
            />
            {priceLabels[type]}
          </label>
        ))}
      </div>
      <section className="overflow-hidden rounded-[18px] border border-border">
        <div className="flex items-center justify-between bg-[#f3f7fa] px-4 py-3">
          <div>
            <h3 className="text-xs font-semibold">订单商品明细</h3>
            <p className="mt-1 text-[9px] text-muted-foreground">
              单价从产品中心读取，服务端会再次校验
            </p>
          </div>
          <button
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-white px-3 text-[10px] font-medium text-primary shadow-sm"
            onClick={() => {
              setLines((current) => [
                ...current,
                { key: nextKey, productId: "", quantity: 1 },
              ]);
              setNextKey((value) => value + 1);
            }}
            type="button"
          >
            <CirclePlus className="size-3.5" />
            添加商品
          </button>
        </div>
        <div className="divide-y divide-border/70">
          {lines.map((line, index) => {
            const product = products.find((item) => item.id === line.productId);
            const unitPrice = product?.prices[priceType] ?? 0;
            return (
              <div
                className="grid gap-2 px-4 py-3 sm:grid-cols-[24px_minmax(0,1fr)_90px_110px_32px] sm:items-center"
                key={line.key}
              >
                <span className="text-[10px] text-muted-foreground">{index + 1}</span>
                <select
                  className="h-10 min-w-0 rounded-xl border border-border bg-white px-3 text-[11px] outline-none focus:border-primary/45"
                  onChange={(event) =>
                    updateLine(line.key, { productId: event.target.value })
                  }
                  required
                  value={line.productId}
                >
                  <option value="">选择产品</option>
                  {availableProducts.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.code} · {option.name}
                      {option.specification ? ` · ${option.specification}` : ""}
                    </option>
                  ))}
                </select>
                <input
                  aria-label={`第 ${index + 1} 行数量`}
                  className="h-10 rounded-xl border border-border px-3 text-right text-[11px] outline-none focus:border-primary/45"
                  min="0.001"
                  onChange={(event) =>
                    updateLine(line.key, { quantity: Number(event.target.value) })
                  }
                  required
                  step="0.001"
                  type="number"
                  value={line.quantity}
                />
                <div className="text-right text-[10px]">
                  <div className="font-medium">{money(unitPrice * line.quantity)}</div>
                  <div className="mt-0.5 text-[8px] text-muted-foreground">
                    {money(unitPrice)} / 件
                  </div>
                </div>
                <button
                  aria-label={`删除第 ${index + 1} 行`}
                  className="grid size-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-red-50 hover:text-red-600"
                  onClick={() => removeLine(line.key)}
                  type="button"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between border-t border-border bg-[#f8fafc] px-4 py-3">
          <span className="text-[10px] text-muted-foreground">草稿订单金额</span>
          <span className="text-lg font-semibold text-[#0a385d]">{money(total)}</span>
        </div>
      </section>
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          className="h-10 rounded-xl border border-border px-3 text-xs outline-none focus:border-primary/45"
          name="paymentTerms"
          placeholder="付款条款（选填）"
        />
        <input
          className="h-10 rounded-xl border border-border px-3 text-xs outline-none focus:border-primary/45"
          name="deliveryTerms"
          placeholder="交付条款（选填）"
        />
      </div>
      <textarea
        className="min-h-20 w-full rounded-xl border border-border px-3 py-2.5 text-xs outline-none focus:border-primary/45"
        name="note"
        placeholder="订单备注"
      />
      <button
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0d6475] to-[#168e98] text-xs font-semibold text-white shadow-[0_12px_28px_-18px_rgba(13,100,117,.8)]"
        type="submit"
      >
        <ShoppingCart className="size-4" />
        保存销售订单草稿
      </button>
    </form>
  );
}
