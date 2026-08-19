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

const statusTones: Record<QuoteRow["status"], string> = {
  draft: "bg-[#edf2f0] text-[#5d7069]",
  sent: "bg-[#e8f1fb] text-[#436f9d]",
  accepted: "bg-[#e7f5ef] text-[#11715d]",
  rejected: "bg-[#fff0f1] text-[#bd5760]",
  expired: "bg-[#fff4e5] text-[#a66d25]",
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
    <article className="rounded-[20px] border border-[#e4ece8] bg-white p-5 shadow-[0_8px_30px_-24px_rgba(23,57,50,.35)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] text-[#75847f]">{label}</div>
          <div className="mt-2 text-[25px] font-semibold tracking-[-0.04em] text-[#173a33]">
            {value}
          </div>
        </div>
        <span className={`grid size-10 place-items-center rounded-xl ${tone}`}>
          {icon}
        </span>
      </div>
      <p className="mt-4 border-t border-[#eaf0f4] pt-3 text-[9px] text-[#899690]">
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
      <main className="mx-auto max-w-[1600px] p-4 sm:p-6 xl:p-8">
        <section className="relative overflow-hidden rounded-[26px] bg-[linear-gradient(120deg,#123f37_0%,#0b574b_58%,#12352f_100%)] px-6 py-7 text-white shadow-[0_20px_56px_-34px_rgba(8,57,49,.72)] sm:px-8">
          <div className="absolute -right-14 -top-24 size-72 rounded-full border border-white/8" />
          <div className="absolute right-24 top-16 size-24 rounded-full border border-[#79d8d5]/14" />
          <ReceiptText className="pointer-events-none absolute right-12 top-1/2 hidden size-40 -translate-y-1/2 text-white/[0.055] sm:block" />
          <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#a8dcc9]">
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
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/15 bg-white/8 px-4 text-[11px] text-white/76 transition hover:bg-white/13 hover:text-white"
                href="/customers"
              >
                <ArrowLeft className="size-3.5" />
                返回客户管理
              </Link>
              <Link
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-[11px] font-medium text-[#0b5f50] transition hover:bg-[#eef8f4]"
                href="/products"
              >
                <PackageSearch className="size-3.5" />
                查看产品库
              </Link>
            </div>
          </div>
        </section>

        {!dataAvailable && (
          <div className="mt-5 rounded-2xl border border-[#ead7b8] bg-[#fff9ef] px-4 py-3 text-xs text-[#8a6633]">
            报价数据表尚未初始化，请执行最新 Supabase 数据库迁移。
          </div>
        )}
        {feedback.created && (
          <div className="mt-5 rounded-2xl border border-[#cfe8ec] bg-[#edf7f2] px-4 py-3 text-xs text-[#0d6c78]">
            {feedback.created}
          </div>
        )}
        {feedback.error && (
          <div className="mt-5 rounded-2xl border border-[#eed3cd] bg-[#fff4f1] px-4 py-3 text-xs text-[#985846]">
            {feedback.error}
          </div>
        )}

        <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric
            icon={<FileText className="size-4.5" />}
            label="报价单数量"
            note="当前权限范围内的报价记录"
            tone="bg-[#e7f5ef] text-[#13715d]"
            value={`${quotes.length}`}
          />
          <Metric
            icon={<ReceiptText className="size-4.5" />}
            label="报价总金额"
            note="包含草稿在内的报价金额汇总"
            tone="bg-[#eaf1fb] text-[#4874a7]"
            value={money(quoteTotal)}
          />
          <Metric
            icon={<BadgeCheck className="size-4.5" />}
            label="已接受"
            note="客户确认接受的报价单"
            tone="bg-[#edf6e8] text-[#587d3d]"
            value={`${acceptedCount}`}
          />
          <Metric
            icon={<UsersRound className="size-4.5" />}
            label="已报价客户"
            note="产生过报价记录的客户数量"
            tone="bg-[#fff4e5] text-[#9a6826]"
            value={`${activeCustomerCount}`}
          />
        </section>

        <div className="mt-5 grid items-start gap-5 2xl:grid-cols-[minmax(0,1.15fr)_minmax(480px,.85fr)]">
          <section className="rounded-[22px] border border-[#dce6ed] bg-white p-5 shadow-[0_10px_34px_rgba(18,67,55,.04)] sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold tracking-[-0.02em]">
                  新建报价单
                </h2>
                <p className="mt-1 text-[10px] text-[#8293a1]">
                  当前仅保存草稿，不会自动发送客户或生成销售订单
                </p>
              </div>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[9px] font-medium ${
                  canManage
                    ? "bg-[#e9f6f0] text-[#16715e]"
                    : "bg-[#f0f3f2] text-[#74817d]"
                }`}
              >
                <ShieldCheck className="size-3" />
                {canManage ? "报价权限已启用" : "当前账号只读"}
              </span>
            </div>
            {canManage && dataAvailable ? (
              <QuoteBuilder customers={customers} products={products} />
            ) : (
              <div className="grid min-h-80 place-items-center rounded-[18px] border border-dashed border-[#dce6e2] bg-[#fafcfe] text-center">
                <div>
                  <ShieldCheck className="mx-auto size-7 text-[#84928d]" />
                  <p className="mt-3 text-xs font-medium">
                    {dataAvailable ? "暂无报价创建权限" : "报价功能等待初始化"}
                  </p>
                  <p className="mt-1 text-[10px] text-[#8c9894]">
                    {dataAvailable
                      ? "销售、客服或管理员可创建报价"
                      : "执行最新数据库迁移后即可使用"}
                  </p>
                </div>
              </div>
            )}
          </section>

          <section className="overflow-hidden rounded-[22px] border border-[#dce6ed] bg-white shadow-[0_10px_34px_rgba(18,67,55,.04)]">
            <div className="flex items-center justify-between border-b border-[#e7eef3] px-5 py-5 sm:px-6">
              <div>
                <h2 className="text-base font-semibold tracking-[-0.02em]">
                  最近报价
                </h2>
                <p className="mt-1 text-[10px] text-[#8293a1]">
                  价格与产品名称按创建时快照留存
                </p>
              </div>
              <span className="rounded-full bg-[#edf4f7] px-2.5 py-1 text-[9px] text-[#557169]">
                {quotes.length} 份
              </span>
            </div>

            {quotes.length ? (
              <div className="divide-y divide-[#eaf0f4]">
                {quotes.map((quote) => {
                  const customer = relatedOne(quote.customers);
                  const owner = relatedOne(quote.employees);
                  return (
                    <article
                      className="px-5 py-4 transition hover:bg-[#fafcfe] sm:px-6"
                      key={quote.id}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link
                              className="text-[11px] font-semibold text-[#234039] transition hover:text-[#0d7580]"
                              href={`/quotes/${quote.id}`}
                            >
                              {quote.quote_no}
                            </Link>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[8px] font-medium ${statusTones[quote.status]}`}
                            >
                              {statusLabels[quote.status]}
                            </span>
                          </div>
                          <div className="mt-2 truncate text-xs font-medium">
                            {customer?.name ?? "客户档案"}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] text-[#8293a1]">
                            <span>{priceTypeLabels[quote.price_type]}</span>
                            <span>
                              {quote.sales_quote_items?.length ?? 0} 项商品
                            </span>
                            <span>负责人：{owner?.name ?? "未分配"}</span>
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-sm font-semibold tabular-nums text-[#173e36]">
                            {money(quote.total_cny)}
                          </div>
                          <div className="mt-1 inline-flex items-center gap-1 text-[9px] text-[#8293a1]">
                            <CalendarClock className="size-3" />
                            至 {dateLabel(quote.valid_until)}
                          </div>
                          <Link
                            className="mt-2 inline-flex text-[9px] font-medium text-[#0d7580]"
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
                  <FileText className="mx-auto size-8 text-[#9aa6a2]" />
                  <p className="mt-3 text-xs font-medium">暂无报价单</p>
                  <p className="mt-1 text-[10px] text-[#8c9894]">
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
