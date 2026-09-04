import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  CircleX,
  Clock3,
  FileCheck2,
  Send,
  ShieldCheck,
} from "lucide-react";
import { WorkflowShell } from "@/features/approvals/workflow-shell";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import { QuotePrintButton } from "@/features/quotes/quote-print-button";
import { transitionSalesQuoteAction } from "@/features/quotes/server-actions";
import { createClient } from "@/lib/supabase/server";
import { statusToneClass } from "@/lib/ui/status";

export const metadata: Metadata = {
  title: "报价单详情",
  description: "德馨星云客户报价详情、状态和操作历史",
};

export const dynamic = "force-dynamic";

type QuoteStatus = "draft" | "sent" | "accepted" | "rejected" | "expired";

type QuoteItem = {
  id: string;
  product_code: string;
  product_name: string;
  specification: string | null;
  unit: string;
  quantity: number | string;
  unit_price_cny: number | string;
  line_total_cny: number | string;
  position: number;
};

type QuoteRecord = {
  id: string;
  quote_no: string;
  status: QuoteStatus;
  price_type: "retail" | "group" | "dropship";
  valid_until: string;
  subtotal_cny: number | string;
  total_cny: number | string;
  payment_terms: string | null;
  delivery_terms: string | null;
  note: string | null;
  created_at: string;
  customers:
    | {
        name: string;
        customer_no: string;
        address: string | null;
      }
    | {
        name: string;
        customer_no: string;
        address: string | null;
      }[]
    | null;
  employees:
    | { name: string; title: string | null }
    | { name: string; title: string | null }[]
    | null;
  sales_quote_items: QuoteItem[] | null;
};

type QuoteEvent = {
  id: string;
  from_status: QuoteStatus | null;
  to_status: QuoteStatus;
  note: string | null;
  created_at: string;
  employees: { name: string } | { name: string }[] | null;
};

const statusLabels: Record<QuoteStatus, string> = {
  draft: "草稿",
  sent: "已发送",
  accepted: "已接受",
  rejected: "已拒绝",
  expired: "已过期",
};

const priceTypeLabels: Record<QuoteRecord["price_type"], string> = {
  retail: "零售价",
  group: "团购价",
  dropship: "代发价",
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

function dateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function dateOnly(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(`${value}T00:00:00`));
}

function roleLabel(roleCodes: string[]) {
  const labels: Record<string, string> = {
    admin: "系统管理员",
    chairman: "董事长",
    finance: "财务",
    hr: "人事行政",
    department_manager: "部门负责人",
    employee: "内部员工",
  };
  return roleCodes.map((code) => labels[code]).filter(Boolean).join(" · ");
}

export default async function QuoteDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ updated?: string; error?: string }>;
}) {
  const employee = await requireCurrentEmployee();
  const { id } = await params;
  const feedback = await searchParams;
  const supabase = await createClient();

  const [quoteResult, eventResult, manageResult] = await Promise.all([
    supabase
      .from("sales_quotes")
      .select(
        "id, quote_no, status, price_type, valid_until, subtotal_cny, total_cny, payment_terms, delivery_terms, note, created_at, customers(name, customer_no, address), employees!sales_quotes_owner_employee_id_fkey(name, title), sales_quote_items(id, product_code, product_name, specification, unit, quantity, unit_price_cny, line_total_cny, position)",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("sales_quote_events")
      .select(
        "id, from_status, to_status, note, created_at, employees!sales_quote_events_actor_employee_id_fkey(name)",
      )
      .eq("quote_id", id)
      .order("created_at", { ascending: true }),
    supabase.rpc("can_manage_customers"),
  ]);

  if (quoteResult.error || !quoteResult.data) {
    notFound();
  }

  const quote = quoteResult.data as QuoteRecord;
  const events = (eventResult.data ?? []) as QuoteEvent[];
  const customer = relatedOne(quote.customers);
  const owner = relatedOne(quote.employees);
  const canManage = Boolean(manageResult.data);
  const items = [...(quote.sales_quote_items ?? [])].sort(
    (left, right) => left.position - right.position,
  );
  const canExpire =
    ["draft", "sent"].includes(quote.status) &&
    quote.valid_until < new Date().toISOString().slice(0, 10);

  return (
    <WorkflowShell
      activeItem="销售管理"
      breadcrumb={`客户与销售 / 销售管理 / 报价 / ${quote.quote_no}`}
      currentUser={{
        name: employee.name,
        roleLabel: roleLabel(employee.roleCodes) || employee.title || "内部员工",
      }}
    >
      <main className="mx-auto max-w-[1200px] p-4 print:max-w-none print:bg-white print:p-0 sm:p-6 xl:p-8">
        <div className="mb-5 flex flex-col gap-3 print:hidden sm:flex-row sm:items-center sm:justify-between">
          <Link
            className="inline-flex h-10 items-center gap-2 self-start rounded-md border border-border bg-white px-4 text-xs font-medium text-foreground transition hover:border-border hover:text-foreground"
            href="/quotes"
          >
            <ArrowLeft className="size-3.5" />
            返回报价中心
          </Link>
          <QuotePrintButton />
        </div>

        {feedback.updated && (
          <div className="mb-5 rounded-lg border border-border bg-muted px-4 py-3 text-xs text-foreground print:hidden">
            {feedback.updated}
          </div>
        )}
        {feedback.error && (
          <div className="mb-5 rounded-lg border border-border bg-muted px-4 py-3 text-xs text-foreground print:hidden">
            {feedback.error}
          </div>
        )}

        <section className="overflow-hidden rounded-md border border-border bg-white  print:rounded-none print:border-0 print:shadow-none">
          <header className="relative overflow-hidden bg-sidebar px-6 py-7 text-white print:border-b print:border-border print:bg-white print:px-0 print:text-foreground sm:px-8">
            <div className="absolute -right-16 -top-24 size-64 rounded-full border border-white/8 print:hidden" />
            <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground print:text-foreground">
                  DEXIN · SALES QUOTATION
                </div>
                <h1 className="mt-3 text-2xl font-semibold tracking-[-0.04em]">
                  长沙德馨淼盛科技有限公司
                </h1>
                <p className="mt-2 text-xs text-white/52 print:text-foreground">
                  专业餐饮粮油供应链服务
                </p>
              </div>
              <div className="text-left sm:text-right">
                <div className="text-xs uppercase tracking-[0.16em] text-white/45 print:text-foreground">
                  Quotation No.
                </div>
                <div className="mt-1 text-base font-semibold tracking-[0.04em]">
                  {quote.quote_no}
                </div>
                <span
                  className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusToneClass(quote.status)}`}
                >
                  {statusLabels[quote.status]}
                </span>
              </div>
            </div>
          </header>

          <div className="px-5 py-6 print:px-0 sm:px-8">
            <div className="grid gap-4 rounded-md border border-border bg-muted p-5 print:grid-cols-3 print:bg-white sm:grid-cols-3">
              <div>
                <div className="text-xs uppercase tracking-[0.14em] text-foreground">
                  报价客户
                </div>
                <div className="mt-2 text-sm font-semibold">
                  {customer?.name ?? "客户档案"}
                </div>
                <div className="mt-1 text-xs text-foreground">
                  {customer?.customer_no}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.14em] text-foreground">
                  报价信息
                </div>
                <div className="mt-2 text-xs font-medium">
                  {priceTypeLabels[quote.price_type]}
                </div>
                <div className="mt-1 text-xs text-foreground">
                  创建：{dateTime(quote.created_at)}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.14em] text-foreground">
                  有效期限
                </div>
                <div className="mt-2 text-xs font-medium">
                  {dateOnly(quote.valid_until)}
                </div>
                <div className="mt-1 text-xs text-foreground">
                  负责人：{owner?.name ?? "未分配"}
                </div>
              </div>
            </div>

            <div className="mt-6 overflow-hidden rounded-md border border-border">
              <div className="grid grid-cols-[42px_minmax(0,1fr)_80px_100px_110px] gap-3 bg-primary px-4 py-3 text-xs font-medium text-white/70 print:bg-muted print:text-foreground">
                <span>序号</span>
                <span>产品信息</span>
                <span className="text-right">数量</span>
                <span className="text-right">单价</span>
                <span className="text-right">金额</span>
              </div>
              <div className="divide-y divide-border">
                {items.map((item, index) => (
                  <div
                    className="grid grid-cols-[42px_minmax(0,1fr)_80px_100px_110px] items-center gap-3 px-4 py-4 text-xs"
                    key={item.id}
                  >
                    <span className="tabular-nums text-foreground">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0">
                      <div className="font-medium text-foreground">
                        {item.product_name}
                      </div>
                      <div className="mt-1 text-xs text-foreground">
                        {item.product_code}
                        {item.specification
                          ? ` · ${item.specification}`
                          : ""}
                      </div>
                    </div>
                    <span className="text-right tabular-nums">
                      {Number(item.quantity)} {item.unit}
                    </span>
                    <span className="text-right tabular-nums">
                      {money(item.unit_price_cny)}
                    </span>
                    <span className="text-right font-semibold tabular-nums text-foreground">
                      {money(item.line_total_cny)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <div className="w-full max-w-sm rounded-md bg-muted p-5">
                <div className="flex items-center justify-between text-xs text-foreground">
                  <span>商品小计</span>
                  <span className="tabular-nums">
                    {money(quote.subtotal_cny)}
                  </span>
                </div>
                <div className="mt-4 flex items-end justify-between border-t border-border pt-4">
                  <span className="text-xs font-medium">报价总计</span>
                  <span className="text-2xl font-semibold tracking-[-0.04em] text-foreground">
                    {money(quote.total_cny)}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-md border border-border p-4">
                <div className="text-xs uppercase tracking-[0.14em] text-foreground">
                  付款约定
                </div>
                <p className="mt-2 text-xs leading-5 text-foreground">
                  {quote.payment_terms ?? "双方另行确认"}
                </p>
              </div>
              <div className="rounded-md border border-border p-4">
                <div className="text-xs uppercase tracking-[0.14em] text-foreground">
                  交付约定
                </div>
                <p className="mt-2 text-xs leading-5 text-foreground">
                  {quote.delivery_terms ?? "双方另行确认"}
                </p>
              </div>
            </div>

            <p className="mt-6 border-t border-border pt-4 text-xs leading-5 text-foreground">
              本报价在有效期内有效；产品库存、配送安排及最终结算以双方确认结果为准。
            </p>
          </div>
        </section>

        <div className="mt-5 grid items-start gap-5 print:hidden xl:grid-cols-[minmax(0,.9fr)_minmax(420px,1.1fr)]">
          <section className="rounded-md border border-border bg-white p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold">报价操作</h2>
                <p className="mt-1 text-xs text-foreground">
                  状态变化不可删除，并写入操作审计
                </p>
              </div>
              <ShieldCheck className="size-4 text-foreground" />
            </div>

            {!canManage ? (
              <div className="mt-5 rounded-md bg-muted px-4 py-3 text-xs text-foreground">
                当前账号拥有只读权限，不能更新报价状态。
              </div>
            ) : quote.status === "draft" ? (
              <form action={transitionSalesQuoteAction} className="mt-5">
                <input name="quoteId" type="hidden" value={quote.id} />
                <input name="targetStatus" type="hidden" value="sent" />
                <label className="block text-xs text-foreground">
                  发送说明（选填）
                  <textarea
                    className="mt-2 min-h-20 w-full rounded-md border border-border bg-muted px-3 py-2.5 text-xs outline-none focus:border-border"
                    name="note"
                    placeholder="例如：已通过企业微信发送给客户采购负责人"
                  />
                </label>
                <button
                  className="mt-3 inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-xs font-medium text-white transition hover:bg-muted"
                  type="submit"
                >
                  <Send className="size-3.5" />
                  标记为已发送
                </button>
              </form>
            ) : quote.status === "sent" ? (
              <form action={transitionSalesQuoteAction} className="mt-5">
                <input name="quoteId" type="hidden" value={quote.id} />
                <label className="block text-xs text-foreground">
                  客户反馈说明
                  <textarea
                    className="mt-2 min-h-24 w-full rounded-md border border-border bg-muted px-3 py-2.5 text-xs outline-none focus:border-border"
                    name="note"
                    placeholder="请记录客户确认方式、联系人和关键反馈"
                    required
                  />
                </label>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-xs font-medium text-white"
                    name="targetStatus"
                    type="submit"
                    value="accepted"
                  >
                    <BadgeCheck className="size-3.5" />
                    客户已接受
                  </button>
                  <button
                    className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-muted px-4 text-xs font-medium text-foreground"
                    name="targetStatus"
                    type="submit"
                    value="rejected"
                  >
                    <CircleX className="size-3.5" />
                    客户已拒绝
                  </button>
                </div>
              </form>
            ) : (
              <div className="mt-5 flex items-center gap-3 rounded-md bg-muted px-4 py-4">
                <FileCheck2 className="size-5 text-foreground" />
                <div>
                  <div className="text-xs font-medium">
                    当前报价已进入终态
                  </div>
                  <div className="mt-1 text-xs text-foreground">
                    {statusLabels[quote.status]}状态不能继续修改
                  </div>
                </div>
              </div>
            )}

            {canManage && canExpire && (
              <form
                action={transitionSalesQuoteAction}
                className="mt-4 border-t border-border pt-4"
              >
                <input name="quoteId" type="hidden" value={quote.id} />
                <input name="targetStatus" type="hidden" value="expired" />
                <input
                  name="note"
                  type="hidden"
                  value="报价有效期已结束"
                />
                <button
                  className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-muted px-3 text-xs font-medium text-foreground"
                  type="submit"
                >
                  <Clock3 className="size-3.5" />
                  标记为已过期
                </button>
              </form>
            )}
          </section>

          <section className="rounded-md border border-border bg-white p-5 sm:p-6">
            <div>
              <h2 className="text-sm font-semibold">状态历史</h2>
              <p className="mt-1 text-xs text-foreground">
                报价从草稿到客户结果的完整时间线
              </p>
            </div>
            <div className="mt-5 space-y-0">
              {events.map((event, index) => {
                const actor = relatedOne(event.employees);
                return (
                  <div
                    className="relative grid grid-cols-[24px_1fr] gap-3 pb-5 last:pb-0"
                    key={event.id}
                  >
                    {index < events.length - 1 && (
                      <span className="absolute bottom-0 left-[11px] top-6 w-px bg-muted" />
                    )}
                    <span className="relative z-10 mt-0.5 grid size-6 place-items-center rounded-full bg-muted text-foreground ring-4 ring-white">
                      <span className="size-1.5 rounded-full bg-current" />
                    </span>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-medium">
                          {event.from_status
                            ? `${statusLabels[event.from_status]} → ${statusLabels[event.to_status]}`
                            : statusLabels[event.to_status]}
                        </span>
                        <span className="text-xs text-foreground">
                          {dateTime(event.created_at)}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-foreground">
                        操作人：{actor?.name ?? "系统"}
                      </div>
                      {event.note && (
                        <p className="mt-2 rounded-lg bg-muted px-3 py-2 text-xs leading-5 text-foreground">
                          {event.note}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </main>
    </WorkflowShell>
  );
}
