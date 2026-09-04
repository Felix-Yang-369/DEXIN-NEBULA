import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarClock,
  FileText,
  PackageSearch,
  ReceiptText,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { WorkflowShell } from "@/features/approvals/workflow-shell";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import {
  QuoteBuilder,
  type QuoteCustomerOption,
  type QuoteProductOption,
} from "@/features/quotes/quote-builder";
import { createClient } from "@/lib/supabase/server";
import { statusToneClass } from "@/lib/ui/status";

export const metadata: Metadata = {
  title: "客户报价中心",
  description: "连接 CRM 客户与 PIM 产品价格的客户报价管理",
};

export const dynamic = "force-dynamic";

type ProductPriceRow = {
  price_type: "procurement" | "retail" | "group" | "dropship";
  amount_cny: number | string;
  status: "active" | "expired";
};

type ProductRow = {
  id: string;
  code: string;
  name: string;
  specification: string | null;
  product_prices: ProductPriceRow[] | null;
};

type QuoteRow = {
  id: string;
  quote_no: string;
  status: "draft" | "sent" | "accepted" | "rejected" | "expired";
  price_type: "retail" | "group" | "dropship";
  valid_until: string;
  total_cny: number | string;
  created_at: string;
  customers: { name: string } | { name: string }[] | null;
  employees: { name: string } | { name: string }[] | null;
  sales_quote_items: { id: string }[] | null;
};

const statusLabels: Record<QuoteRow["status"], string> = {
  draft: "草稿",
  sent: "已发送",
  accepted: "已接受",
  rejected: "已拒绝",
  expired: "已过期",
};

const priceTypeLabels: Record<QuoteRow["price_type"], string> = {
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

function dateLabel(value: string) {
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

function Metric({
  icon,
  label,
  value,
  note,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  note: string;
  tone: string;
}) {
  return (
    <article className="rounded-md border border-border bg-white p-5 ">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs text-foreground">{label}</div>
          <div className="mt-2 text-[25px] font-semibold tracking-[-0.04em] text-foreground">
            {value}
          </div>
        </div>
        <span className={`grid size-10 place-items-center rounded-md ${tone}`}>
          {icon}
        </span>
      </div>
      <p className="mt-4 border-t border-border pt-3 text-xs text-foreground">
        {note}
      </p>
    </article>
  );
}

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; error?: string }>;
}) {
  const employee = await requireCurrentEmployee();
  const feedback = await searchParams;
  const supabase = await createClient();

  const [customerResult, productResult, quoteResult, manageResult] =
    await Promise.all([
      supabase
        .from("customers")
        .select("id, customer_no, name, level, status")
        .neq("status", "inactive")
        .order("level")
        .order("name")
        .limit(200),
      supabase
        .from("products")
        .select(
          "id, code, name, specification, product_prices(price_type, amount_cny, status)",
        )
        .eq("status", "active")
        .order("code")
        .limit(300),
      supabase
        .from("sales_quotes")
        .select(
          "id, quote_no, status, price_type, valid_until, total_cny, created_at, customers(name), employees!sales_quotes_owner_employee_id_fkey(name), sales_quote_items(id)",
        )
        .order("created_at", { ascending: false })
        .limit(50),
      supabase.rpc("can_manage_customers"),
    ]);

  const dataAvailable = !quoteResult.error;
  const canManage = Boolean(manageResult.data);
  const customers: QuoteCustomerOption[] = (customerResult.data ?? []).map(
    (customer) => ({
      id: customer.id,
      customerNo: customer.customer_no,
      name: customer.name,
      level: customer.level,
    }),
  );
  const products: QuoteProductOption[] = (
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
  const quotes = (quoteResult.data ?? []) as QuoteRow[];
  const quoteTotal = quotes.reduce(
    (sum, quote) => sum + Number(quote.total_cny),
    0,
  );
  const acceptedCount = quotes.filter(
    (quote) => quote.status === "accepted",
  ).length;
  const activeCustomerCount = new Set(
    quotes.map((quote) => relatedOne(quote.customers)?.name).filter(Boolean),
  ).size;

  return (
    <WorkflowShell
      activeItem="销售管理"
      breadcrumb="客户与销售 / 销售管理 / 报价"
      currentUser={{
        name: employee.name,
        roleLabel: roleLabel(employee.roleCodes) || employee.title || "内部员工",
      }}
    >
      <main className="mx-auto max-w-[1440px] p-4 sm:p-6 xl:p-8">
        <section className="ui-page-header">
          <div className="absolute -right-14 -top-24 size-72 rounded-full border border-white/8" />
          <div className="absolute right-24 top-16 size-24 rounded-full border border-border" />
          <ReceiptText className="pointer-events-none absolute right-12 top-1/2 hidden size-40 -translate-y-1/2 text-white/[0.055] sm:block" />
          <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                CRM · Sales Quotation
              </div>
              <h1 className="mt-3 text-2xl font-semibold tracking-[-0.035em] sm:text-[30px]">
                客户报价中心
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/56">
                从客户主档与产品价格生成统一报价，保存商品、价格和条款快照，为后续销售订单建立可信基础。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                className="inline-flex h-10 items-center gap-2 rounded-md border border-white/15 bg-white/8 px-4 text-xs text-white/76 transition hover:bg-white/13 hover:text-white"
                href="/customers"
              >
                <ArrowLeft className="size-3.5" />
                返回客户管理
              </Link>
              <Link
                className="inline-flex h-10 items-center gap-2 rounded-md bg-white px-4 text-xs font-medium text-foreground transition hover:bg-muted"
                href="/products"
              >
                <PackageSearch className="size-3.5" />
                查看产品库
              </Link>
            </div>
          </div>
        </section>

        {!dataAvailable && (
          <div className="mt-5 rounded-lg border border-border bg-muted px-4 py-3 text-xs text-foreground">
            报价数据表尚未初始化，请执行最新 Supabase 数据库迁移。
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
          <Metric
            icon={<FileText className="size-4.5" />}
            label="报价单数量"
            note="当前权限范围内的报价记录"
            tone="bg-muted text-foreground"
            value={`${quotes.length}`}
          />
          <Metric
            icon={<ReceiptText className="size-4.5" />}
            label="报价总金额"
            note="包含草稿在内的报价金额汇总"
            tone="bg-muted text-foreground"
            value={money(quoteTotal)}
          />
          <Metric
            icon={<BadgeCheck className="size-4.5" />}
            label="已接受"
            note="客户确认接受的报价单"
            tone="bg-muted text-foreground"
            value={`${acceptedCount}`}
          />
          <Metric
            icon={<UsersRound className="size-4.5" />}
            label="已报价客户"
            note="产生过报价记录的客户数量"
            tone="bg-muted text-foreground"
            value={`${activeCustomerCount}`}
          />
        </section>

        <div className="mt-5 grid items-start gap-5 2xl:grid-cols-[minmax(0,1.15fr)_minmax(480px,.85fr)]">
          <section className="rounded-md border border-border bg-white p-5  sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold tracking-[-0.02em]">
                  新建报价单
                </h2>
                <p className="mt-1 text-xs text-foreground">
                  当前仅保存草稿，不会自动发送客户或生成销售订单
                </p>
              </div>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${
                  canManage
                    ? "bg-muted text-foreground"
                    : "bg-muted text-foreground"
                }`}
              >
                <ShieldCheck className="size-3" />
                {canManage ? "报价权限已启用" : "当前账号只读"}
              </span>
            </div>
            {canManage && dataAvailable ? (
              <QuoteBuilder customers={customers} products={products} />
            ) : (
              <div className="grid min-h-80 place-items-center rounded-md border border-dashed border-border bg-muted text-center">
                <div>
                  <ShieldCheck className="mx-auto size-7 text-foreground" />
                  <p className="mt-3 text-xs font-medium">
                    {dataAvailable ? "暂无报价创建权限" : "报价功能等待初始化"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {dataAvailable
                      ? "销售、客服或管理员可创建报价"
                      : "执行最新数据库迁移后即可使用"}
                  </p>
                </div>
              </div>
            )}
          </section>

          <section className="overflow-hidden rounded-md border border-border bg-white ">
            <div className="flex items-center justify-between border-b border-border px-5 py-5 sm:px-6">
              <div>
                <h2 className="text-base font-semibold tracking-[-0.02em]">
                  最近报价
                </h2>
                <p className="mt-1 text-xs text-foreground">
                  价格与产品名称按创建时快照留存
                </p>
              </div>
              <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-foreground">
                {quotes.length} 份
              </span>
            </div>

            {quotes.length ? (
              <div className="divide-y divide-border">
                {quotes.map((quote) => {
                  const customer = relatedOne(quote.customers);
                  const owner = relatedOne(quote.employees);
                  return (
                    <article
                      className="px-5 py-4 transition hover:bg-muted sm:px-6"
                      key={quote.id}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link
                              className="text-xs font-semibold text-foreground transition hover:text-foreground"
                              href={`/quotes/${quote.id}`}
                            >
                              {quote.quote_no}
                            </Link>
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusToneClass(quote.status)}`}
                            >
                              {statusLabels[quote.status]}
                            </span>
                          </div>
                          <div className="mt-2 truncate text-xs font-medium">
                            {customer?.name ?? "客户档案"}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-foreground">
                            <span>{priceTypeLabels[quote.price_type]}</span>
                            <span>
                              {quote.sales_quote_items?.length ?? 0} 项商品
                            </span>
                            <span>负责人：{owner?.name ?? "未分配"}</span>
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-sm font-semibold tabular-nums text-foreground">
                            {money(quote.total_cny)}
                          </div>
                          <div className="mt-1 inline-flex items-center gap-1 text-xs text-foreground">
                            <CalendarClock className="size-3" />
                            至 {dateLabel(quote.valid_until)}
                          </div>
                          <Link
                            className="mt-2 inline-flex text-xs font-medium text-foreground"
                            href={`/quotes/${quote.id}`}
                          >
                            查看详情 →
                          </Link>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="grid min-h-[360px] place-items-center text-center">
                <div>
                  <FileText className="mx-auto size-8 text-muted-foreground" />
                  <p className="mt-3 text-xs font-medium">暂无报价单</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    创建第一份报价草稿后会显示在这里
                  </p>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
    </WorkflowShell>
  );
}
