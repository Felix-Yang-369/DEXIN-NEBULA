"use client";

import { useMemo, useState } from "react";
import { CirclePlus, PackageSearch, Trash2 } from "lucide-react";
import { createSalesQuoteAction } from "@/features/quotes/server-actions";

export type QuoteCustomerOption = {
  id: string;
  customerNo: string;
  name: string;
  level: string;
};

export type QuoteProductOption = {
  id: string;
  code: string;
  name: string;
  specification: string | null;
  prices: Partial<Record<QuotePriceType, number>>;
};

type QuotePriceType = "retail" | "group" | "dropship";

type QuoteLine = {
  key: number;
  productId: string;
  quantity: number;
};

const priceTypeLabels: Record<QuotePriceType, string> = {
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

export function QuoteBuilder({
  customers,
  products,
}: {
  customers: QuoteCustomerOption[];
  products: QuoteProductOption[];
}) {
  const [priceType, setPriceType] = useState<QuotePriceType>("retail");
  const [lines, setLines] = useState<QuoteLine[]>([
    { key: 1, productId: "", quantity: 1 },
  ]);
  const [nextKey, setNextKey] = useState(2);

  const availableProducts = useMemo(
    () => products.filter((product) => product.prices[priceType] !== undefined),
    [priceType, products],
  );

  const total = lines.reduce((sum, line) => {
    const product = products.find((item) => item.id === line.productId);
    return sum + (product?.prices[priceType] ?? 0) * line.quantity;
  }, 0);

  const serializedItems = JSON.stringify(
    lines
      .filter((line) => line.productId && line.quantity > 0)
      .map((line) => ({
        productId: line.productId,
        quantity: line.quantity,
      })),
  );

  function updateLine(key: number, patch: Partial<QuoteLine>) {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  }

  function addLine() {
    setLines((current) => [
      ...current,
      { key: nextKey, productId: "", quantity: 1 },
    ]);
    setNextKey((value) => value + 1);
  }

  function removeLine(key: number) {
    setLines((current) =>
      current.length === 1
        ? [{ key: current[0].key, productId: "", quantity: 1 }]
        : current.filter((line) => line.key !== key),
    );
  }

  const defaultValidUntil = new Date();
  defaultValidUntil.setDate(defaultValidUntil.getDate() + 7);
  const validUntilValue = defaultValidUntil.toISOString().slice(0, 10);

  return (
    <form action={createSalesQuoteAction} className="space-y-5">
      <input name="items" type="hidden" value={serializedItems} />

      <div className="grid gap-4 md:grid-cols-3">
        <label className="space-y-2 md:col-span-2">
          <span className="text-xs font-medium text-foreground">
            报价客户
          </span>
          <select
            className="h-11 w-full rounded-md border border-border bg-muted px-3 text-xs outline-none transition focus:border-border focus:bg-white focus:ring-4 focus:ring-ring/20"
            name="customerId"
            required
          >
            <option value="">选择合作客户</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.level}级 · {customer.name} · {customer.customerNo}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2">
          <span className="text-xs font-medium text-foreground">
            报价有效期
          </span>
          <input
            className="h-11 w-full rounded-md border border-border bg-muted px-3 text-xs outline-none transition focus:border-border focus:bg-white focus:ring-4 focus:ring-ring/20"
            defaultValue={validUntilValue}
            name="validUntil"
            required
            type="date"
          />
        </label>
      </div>

      <div>
        <div className="mb-2 text-xs font-medium text-foreground">
          价格口径
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {(Object.keys(priceTypeLabels) as QuotePriceType[]).map((type) => (
            <label
              className={`cursor-pointer rounded-md border px-4 py-3 transition ${
                priceType === type
                  ? "border-border bg-muted text-foreground "
                  : "border-border bg-white text-foreground hover:bg-muted"
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
              <span className="text-xs font-medium">{priceTypeLabels[type]}</span>
              <span className="mt-1 block text-xs opacity-65">
                {availableProducts.length} 个产品已配置
              </span>
            </label>
          ))}
        </div>
      </div>

      <section className="overflow-hidden rounded-md border border-border">
        <div className="flex items-center justify-between border-b border-border bg-muted px-4 py-3">
          <div>
            <h3 className="text-xs font-semibold">报价商品</h3>
            <p className="mt-1 text-xs text-foreground">
              单价由产品中心当前有效价格自动带入，保存时由服务端再次核验
            </p>
          </div>
          <button
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-white px-3 text-xs font-medium text-foreground transition hover:border-border hover:bg-muted"
            onClick={addLine}
            type="button"
          >
            <CirclePlus className="size-3.5" />
            添加商品
          </button>
        </div>

        <div className="divide-y divide-border">
          {lines.map((line, index) => {
            const product = products.find(
              (item) => item.id === line.productId,
            );
            const unitPrice = product?.prices[priceType] ?? 0;
            return (
              <div
                className="grid gap-3 px-4 py-4 sm:grid-cols-[28px_minmax(0,1fr)_100px_110px_34px] sm:items-center"
                key={line.key}
              >
                <span className="grid size-7 place-items-center rounded-lg bg-muted text-xs font-semibold text-foreground">
                  {index + 1}
                </span>
                <select
                  aria-label={`第 ${index + 1} 行商品`}
                  className="h-10 min-w-0 rounded-md border border-border bg-white px-3 text-xs outline-none focus:border-border"
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
                      {option.specification
                        ? ` · ${option.specification}`
                        : ""}
                    </option>
                  ))}
                </select>
                <label>
                  <span className="sr-only">数量</span>
                  <input
                    aria-label={`第 ${index + 1} 行数量`}
                    className="h-10 w-full rounded-md border border-border bg-white px-3 text-right text-xs tabular-nums outline-none focus:border-border"
                    min="0.01"
                    onChange={(event) =>
                      updateLine(line.key, {
                        quantity: Number(event.target.value),
                      })
                    }
                    required
                    step="0.01"
                    type="number"
                    value={line.quantity}
                  />
                </label>
                <div className="text-right">
                  <div className="text-xs text-foreground">
                    {money(unitPrice)} / 件
                  </div>
                  <div className="mt-1 text-xs font-semibold tabular-nums text-foreground">
                    {money(unitPrice * line.quantity)}
                  </div>
                </div>
                <button
                  aria-label={`删除第 ${index + 1} 行`}
                  className="grid size-8 place-items-center rounded-lg text-foreground transition hover:bg-muted hover:text-foreground"
                  onClick={() => removeLine(line.key)}
                  type="button"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-xs font-medium text-foreground">
            付款约定
          </span>
          <input
            className="h-11 w-full rounded-md border border-border bg-muted px-3 text-xs outline-none focus:border-border"
            name="paymentTerms"
            placeholder="例如：款到发货、月结 30 天"
          />
        </label>
        <label className="space-y-2">
          <span className="text-xs font-medium text-foreground">
            交付约定
          </span>
          <input
            className="h-11 w-full rounded-md border border-border bg-muted px-3 text-xs outline-none focus:border-border"
            name="deliveryTerms"
            placeholder="例如：长沙市内配送、运费另计"
          />
        </label>
      </div>

      <label className="block space-y-2">
        <span className="text-xs font-medium text-foreground">内部备注</span>
        <textarea
          className="min-h-20 w-full resize-y rounded-md border border-border bg-muted px-3 py-3 text-xs outline-none focus:border-border"
          name="note"
          placeholder="仅内部可见，不作为正式报价条款"
        />
      </label>

      <div className="flex flex-col gap-4 rounded-md bg-primary px-5 py-4 text-white sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-md bg-white/10 text-muted-foreground">
            <PackageSearch className="size-4.5" />
          </span>
          <div>
            <div className="text-xs uppercase tracking-[0.16em] text-white/45">
              Quotation Total
            </div>
            <div className="mt-1 text-xl font-semibold tracking-[-0.03em]">
              {money(total)}
            </div>
          </div>
        </div>
        <button
          className="h-10 rounded-md bg-white px-5 text-xs font-semibold text-foreground  transition  hover:bg-muted"
          disabled={!customers.length || !availableProducts.length}
          type="submit"
        >
          保存报价草稿
        </button>
      </div>
    </form>
  );
}
