import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  CalendarRange,
  Download,
  FileSpreadsheet,
  Percent,
  Receipt,
  Search,
  ShieldAlert,
  WalletCards,
} from "lucide-react";
import { WorkflowShell } from "@/features/approvals/workflow-shell";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import {
  normalizeReceivableSummaryRows,
  receivableCollectionRate,
  receivableReportQuery,
  resolveReceivableReportRange,
  summarizeReceivableRows,
  type ReceivableSummaryRow,
} from "@/features/finance/receivable-summary";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "应收账款汇总表",
  description: "按客户、业务员和期间汇总应收、回款、余额与逾期风险",
};

export const dynamic = "force-dynamic";

const currency = new Intl.NumberFormat("zh-CN", {
  style: "currency",
  currency: "CNY",
  minimumFractionDigits: 2,
});

const compactCurrency = new Intl.NumberFormat("zh-CN", {
  style: "currency",
  currency: "CNY",
  notation: "compact",
  maximumFractionDigits: 1,
});

function roleLabel(roleCodes: string[]) {
  if (roleCodes.includes("chairman")) return "董事长";
  if (roleCodes.includes("finance")) return "财务";
  return "内部员工";
}

function percent(value: number | null) {
  return value === null ? "—" : `${(value * 100).toFixed(1)}%`;
}

function MetricCard({
  title,
  value,
  note,
  icon,
  warning = false,
}: {
  title: string;
  value: string;
  note: string;
  icon: React.ReactNode;
  warning?: boolean;
}) {
  return (
    <article className="rounded-[18px] border border-[#dce6ed] bg-white p-5 shadow-[0_12px_32px_-26px_rgba(12,47,41,.45)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs text-muted-foreground">{title}</div>
          <div
            className={`mt-2 text-xl font-semibold tracking-[-0.04em] ${
              warning ? "text-[#c8515b]" : "text-[#143b34]"
            }`}
          >
            {value}
          </div>
        </div>
        <div
          className={`grid size-10 place-items-center rounded-xl ${
            warning ? "bg-[#fff0f1] text-[#c8515b]" : "bg-[#e8f4ef] text-[#0d7580]"
          }`}
        >
          {icon}
        </div>
      </div>
      <div className="mt-4 border-t border-[#eaf0f4] pt-3 text-[10px] text-muted-foreground">
        {note}
      </div>
    </article>
  );
}

export default async function ReceivableSummaryPage({
  searchParams,
}: {
  searchParams: Promise<{
    startDate?: string;
    endDate?: string;
    search?: string;
    includeZero?: string;
  }>;
}) {
  const employee = await requireCurrentEmployee();
  const canView =
    employee.roleCodes.includes("finance") ||
    employee.roleCodes.includes("chairman");
  const filters = await searchParams;
  const { startDate, endDate } = resolveReceivableReportRange(
    filters.startDate,
    filters.endDate,
  );
  const search = filters.search?.trim() ?? "";
  const includeZero = filters.includeZero === "1";

  let rows: ReceivableSummaryRow[] = [];
  let queryError: string | null = null;

  if (canView) {
    const supabase = await createClient();
    const result = await supabase.rpc(
      "finance_receivable_summary",
      receivableReportQuery({ startDate, endDate, search, includeZero }),
    );
    if (result.error) {
      console.error("finance receivable summary failed", result.error.code);
      queryError =
        result.error.code === "PGRST202" || result.error.code === "42883"
          ? "应收汇总账数据库迁移尚未执行，请先完成本次数据库升级。"
          : "应收汇总数据读取失败，请稍后重试。";
    } else {
      rows = normalizeReceivableSummaryRows(result.data);
    }
  }

  const totals = summarizeReceivableRows(rows);
  const exportParams = new URLSearchParams({
    startDate,
    endDate,
    includeZero: includeZero ? "1" : "0",
  });
  if (search) exportParams.set("search", search);

  return (
    <WorkflowShell
      activeItem="会计核算"
      breadcrumb="财务管理 / 会计核算 / 应收账款"
      currentUser={{
        name: employee.name,
        roleLabel: roleLabel(employee.roleCodes),
      }}
    >
      <main className="mx-auto max-w-[1700px] p-4 sm:p-6 xl:p-8">
        <section className="overflow-hidden rounded-[24px] bg-[#0a385d] px-6 py-7 text-white shadow-[0_18px_50px_-32px_rgba(12,47,41,.75)] sm:px-8">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <Link
                className="inline-flex items-center gap-1.5 text-xs text-white/55 transition hover:text-white"
                href="/finance"
              >
                <ArrowLeft className="size-3.5" />
                返回财务管理
              </Link>
              <div className="mt-5 text-xs font-medium tracking-[0.14em] text-[#79d8d5]">
                AR · ACCOUNTS RECEIVABLE
              </div>
              <h1 className="mt-2 text-2xl font-semibold tracking-[-0.035em] sm:text-[30px]">
                应收账款汇总表
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-white/55">
                参考金蝶汇总账的期间口径，按客户与默认业务员查看期初、本期应收、本期回款、期末余额及逾期风险。
              </p>
            </div>
            {canView ? (
              <a
                className="inline-flex h-10 items-center gap-2 self-start rounded-xl bg-white px-4 text-xs font-medium text-[#0b3a5d] transition hover:bg-[#eaf3f8] lg:self-auto"
                href={`/finance/receivables/export?${exportParams.toString()}`}
              >
                <Download className="size-4" />
                导出 Excel
              </a>
            ) : null}
          </div>
        </section>

        {!canView ? (
          <section className="mt-5 rounded-[20px] border border-border/75 bg-white px-6 py-16 text-center">
            <ShieldAlert className="mx-auto size-10 text-muted-foreground/60" />
            <h2 className="mt-4 text-base font-semibold">暂无应收汇总账访问权限</h2>
            <p className="mt-2 text-xs text-muted-foreground">
              该报表仅向财务角色和董事长开放。
            </p>
          </section>
        ) : (
          <>
            <form className="mt-5 rounded-[20px] border border-[#dce6ed] bg-white p-4 shadow-[0_12px_32px_-28px_rgba(12,47,41,.45)]">
              <div className="grid gap-3 lg:grid-cols-[180px_180px_minmax(220px,1fr)_auto_auto] lg:items-end">
                <label className="grid gap-1.5 text-xs text-muted-foreground">
                  开始日期
                  <span className="relative">
                    <CalendarRange className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      className="h-10 w-full rounded-xl border border-[#dce6ed] bg-[#fafcfe] pl-9 pr-3 text-sm text-foreground outline-none transition focus:border-[#6ba18f]"
                      defaultValue={startDate}
                      name="startDate"
                      type="date"
                    />
                  </span>
                </label>
                <label className="grid gap-1.5 text-xs text-muted-foreground">
                  结束日期
                  <span className="relative">
                    <CalendarRange className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      className="h-10 w-full rounded-xl border border-[#dce6ed] bg-[#fafcfe] pl-9 pr-3 text-sm text-foreground outline-none transition focus:border-[#6ba18f]"
                      defaultValue={endDate}
                      name="endDate"
                      type="date"
                    />
                  </span>
                </label>
                <label className="grid gap-1.5 text-xs text-muted-foreground">
                  客户 / 编码 / 业务员
                  <span className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      className="h-10 w-full rounded-xl border border-[#dce6ed] bg-[#fafcfe] pl-9 pr-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/65 focus:border-[#6ba18f]"
                      defaultValue={search}
                      name="search"
                      placeholder="输入关键词查询"
                    />
                  </span>
                </label>
                <label className="flex h-10 items-center gap-2 rounded-xl border border-[#dce6ed] bg-[#fafcfe] px-3 text-xs text-muted-foreground">
                  <input
                    className="size-4 accent-[#0d7580]"
                    defaultChecked={includeZero}
                    name="includeZero"
                    type="checkbox"
                    value="1"
                  />
                  显示零余额
                </label>
                <button
                  className="h-10 rounded-xl bg-[#0d7580] px-5 text-xs font-medium text-white transition hover:bg-[#155347]"
                  type="submit"
                >
                  查询
                </button>
              </div>
            </form>

            {queryError ? (
              <div className="mt-5 flex items-start gap-3 rounded-[18px] border border-[#f2c8cc] bg-[#fff7f8] p-5 text-sm text-[#9e3f48]">
                <AlertTriangle className="mt-0.5 size-5 shrink-0" />
                <div>
                  <div className="font-medium">报表暂不可用</div>
                  <div className="mt-1 text-xs leading-6 text-[#ad5b63]">{queryError}</div>
                </div>
              </div>
            ) : null}

            <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <MetricCard
                icon={<WalletCards className="size-5" />}
                note={`${rows.length} 个客户 · ${totals.documentCount} 张应收单`}
                title="期初应收余额"
                value={compactCurrency.format(totals.openingBalance)}
              />
              <MetricCard
                icon={<Receipt className="size-5" />}
                note={`${startDate} 至 ${endDate}`}
                title="本期新增应收"
                value={compactCurrency.format(totals.periodReceivable)}
              />
              <MetricCard
                icon={<Banknote className="size-5" />}
                note="按核销日期统计本期回款"
                title="本期已收"
                value={compactCurrency.format(totals.periodReceived)}
              />
              <MetricCard
                icon={<FileSpreadsheet className="size-5" />}
                note="截至查询结束日期"
                title="期末应收余额"
                value={compactCurrency.format(totals.endingBalance)}
              />
              <MetricCard
                icon={<Percent className="size-5" />}
                note={`逾期 ${compactCurrency.format(totals.overdueBalance)}`}
                title="期间收款率"
                value={percent(totals.collectionRate)}
                warning={totals.overdueBalance > 0}
              />
            </section>

            <section className="mt-5 overflow-hidden rounded-[20px] border border-[#dbe5e1] bg-white shadow-[0_14px_40px_-32px_rgba(12,47,41,.5)]">
              <div className="flex flex-col justify-between gap-2 border-b border-[#dfe8ef] px-5 py-4 sm:flex-row sm:items-center">
                <div>
                  <h2 className="text-sm font-semibold text-[#153b34]">客户应收汇总明细</h2>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    金额单位：人民币元 · 按期末余额降序
                  </p>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  数据更新时间：实时读取德馨星云财务单据
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-[1320px] w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#0a385d] text-white">
                      <th className="border-r border-white/10 px-3 py-2 text-center font-medium" colSpan={4}>
                        客户与业务员
                      </th>
                      <th className="border-r border-white/10 px-3 py-2 text-center font-medium">
                        期初
                      </th>
                      <th className="border-r border-white/10 px-3 py-2 text-center font-medium" colSpan={2}>
                        本期发生
                      </th>
                      <th className="px-3 py-2 text-center font-medium" colSpan={4}>
                        期末与风险
                      </th>
                    </tr>
                    <tr className="bg-[#256355] text-white/90">
                      {[
                        "客户编码",
                        "客户名称",
                        "业务员编码",
                        "默认业务员",
                        "期初余额",
                        "本期应收",
                        "本期已收",
                        "期末余额",
                        "逾期余额",
                        "收款率",
                        "单据数",
                      ].map((label) => (
                        <th className="whitespace-nowrap border-r border-white/10 px-3 py-2.5 text-left font-medium last:border-r-0" key={label}>
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const rate = receivableCollectionRate(
                        row.opening_balance,
                        row.period_receivable,
                        row.period_received,
                      );
                      return (
                        <tr className="border-b border-[#e8eeeb] transition hover:bg-[#f5faf7]" key={row.customer_key}>
                          <td className="whitespace-nowrap px-3 py-3 font-mono text-[11px] text-muted-foreground">
                            {row.customer_no || "—"}
                          </td>
                          <td className="max-w-[260px] px-3 py-3 font-medium text-[#0a385d]">
                            {row.customer_id ? (
                              <Link
                                className="underline-offset-4 transition hover:text-[#2a7967] hover:underline"
                                href={`/finance/receivables/${row.customer_id}?startDate=${startDate}&endDate=${endDate}`}
                              >
                                {row.customer_name}
                              </Link>
                            ) : (
                              row.customer_name
                            )}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 font-mono text-[11px] text-muted-foreground">
                            {row.salesperson_no || "—"}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3">
                            {row.salesperson_name || "未分配"}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">
                            {currency.format(row.opening_balance)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">
                            {currency.format(row.period_receivable)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-[#0d7580]">
                            {currency.format(row.period_received)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-right font-medium tabular-nums">
                            {currency.format(row.ending_balance)}
                          </td>
                          <td className={`whitespace-nowrap px-3 py-3 text-right font-medium tabular-nums ${row.overdue_balance > 0 ? "text-[#c8515b]" : "text-muted-foreground"}`}>
                            {currency.format(row.overdue_balance)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">
                            {percent(rate)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">
                            {row.document_count}
                          </td>
                        </tr>
                      );
                    })}
                    {!rows.length && !queryError ? (
                      <tr>
                        <td className="px-6 py-16 text-center text-sm text-muted-foreground" colSpan={11}>
                          当前查询范围内暂无应收数据。请调整期间或先在财务管理中建立应收单据。
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                  <tfoot>
                    <tr className="bg-[#f8f0df] font-semibold text-[#0a385d]">
                      <td className="px-3 py-3" colSpan={4}>合计</td>
                      <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">{currency.format(totals.openingBalance)}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">{currency.format(totals.periodReceivable)}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">{currency.format(totals.periodReceived)}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">{currency.format(totals.endingBalance)}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-[#c8515b]">{currency.format(totals.overdueBalance)}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">{percent(totals.collectionRate)}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">{totals.documentCount}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <div className="border-t border-[#dfe8ef] bg-[#fafcfe] px-5 py-3 text-[10px] leading-5 text-muted-foreground">
                口径：期初余额为开始日期前已开应收减去此前核销；本期应收按开单日期统计；本期已收按核销日期统计；逾期按截止日和单据到期日判断。尚未录入德馨星云的金蝶历史单据不会计入本报表。
              </div>
            </section>
          </>
        )}
      </main>
    </WorkflowShell>
  );
}
