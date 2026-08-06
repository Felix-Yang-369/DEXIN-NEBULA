import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CalendarRange, ReceiptText, Search } from "lucide-react";
import { WorkflowShell } from "@/features/approvals/workflow-shell";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import { resolveReceivableReportRange } from "@/features/finance/receivable-summary";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "客户应收对账单",
  description: "客户应收期初、开单、收款核销及余额明细",
};

export const dynamic = "force-dynamic";

type StatementRow = {
  entry_date: string;
  entry_type: "opening" | "receivable" | "receipt";
  document_no: string;
  source_no: string | null;
  summary: string;
  debit_amount: number;
  credit_amount: number;
  running_balance: number;
};

const currency = new Intl.NumberFormat("zh-CN", {
  style: "currency",
  currency: "CNY",
  minimumFractionDigits: 2,
});

function roleLabel(roleCodes: string[]) {
  return roleCodes.includes("chairman") ? "董事长" : "财务";
}

function typeLabel(type: StatementRow["entry_type"]) {
  return {
    opening: "期初",
    receivable: "应收",
    receipt: "收款",
  }[type];
}

export default async function CustomerStatementPage({
  params,
  searchParams,
}: {
  params: Promise<{ customerId: string }>;
  searchParams: Promise<{ startDate?: string; endDate?: string }>;
}) {
  const employee = await requireCurrentEmployee();
  const canView =
    employee.roleCodes.includes("finance") ||
    employee.roleCodes.includes("chairman");
  const { customerId } = await params;
  const filters = await searchParams;
  const { startDate, endDate } = resolveReceivableReportRange(
    filters.startDate,
    filters.endDate,
  );
  const supabase = await createClient();

  const customerResult = canView
    ? await supabase
        .from("customers")
        .select("id, customer_no, name, region, owner_employee_id")
        .eq("id", customerId)
        .maybeSingle()
    : { data: null, error: null };
  const statementResult =
    canView && customerResult.data
      ? await supabase.rpc("finance_customer_statement", {
          p_customer_id: customerId,
          p_start_date: startDate,
          p_end_date: endDate,
        })
      : { data: [], error: null };

  let salespersonName: string | null = null;
  if (customerResult.data?.owner_employee_id) {
    const ownerResult = await supabase
      .from("employees")
      .select("name")
      .eq("id", customerResult.data.owner_employee_id)
      .maybeSingle();
    salespersonName = ownerResult.data?.name ?? null;
  }

  const rawStatementRows = (statementResult.data ?? []) as unknown[];
  const rows: StatementRow[] = rawStatementRows.map((item) => {
    const row = item as Record<string, unknown>;
    return {
      entry_date: String(row.entry_date ?? ""),
      entry_type: String(row.entry_type ?? "opening") as StatementRow["entry_type"],
      document_no: String(row.document_no ?? ""),
      source_no: row.source_no ? String(row.source_no) : null,
      summary: String(row.summary ?? ""),
      debit_amount: Number(row.debit_amount ?? 0),
      credit_amount: Number(row.credit_amount ?? 0),
      running_balance: Number(row.running_balance ?? 0),
    };
  });
  const debitTotal = rows.reduce((sum, row) => sum + row.debit_amount, 0);
  const creditTotal = rows.reduce((sum, row) => sum + row.credit_amount, 0);
  const endingBalance = rows.at(-1)?.running_balance ?? 0;
  const backParams = new URLSearchParams({ startDate, endDate });

  return (
    <WorkflowShell
      activeItem="财务管理"
      breadcrumb="财务管理 / 应收汇总 / 客户对账单"
      currentUser={{
        name: employee.name,
        roleLabel: roleLabel(employee.roleCodes),
      }}
    >
      <main className="mx-auto max-w-[1500px] p-4 sm:p-6 xl:p-8">
        <section className="rounded-[24px] bg-[#0a385d] px-6 py-7 text-white shadow-[0_18px_50px_-32px_rgba(12,47,41,.75)] sm:px-8">
          <Link
            className="inline-flex items-center gap-1.5 text-xs text-white/55 transition hover:text-white"
            href={`/finance/receivables?${backParams.toString()}`}
          >
            <ArrowLeft className="size-3.5" />
            返回应收汇总账
          </Link>
          <div className="mt-5 text-xs font-medium tracking-[0.14em] text-[#79d8d5]">
            CUSTOMER STATEMENT
          </div>
          <div className="mt-2 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <div>
              <h1 className="text-2xl font-semibold tracking-[-0.035em] sm:text-[30px]">
                {customerResult.data?.name ?? "客户应收对账单"}
              </h1>
              <p className="mt-3 text-sm text-white/55">
                客户编码 {customerResult.data?.customer_no ?? "—"} · 默认业务员{" "}
                {salespersonName ?? "未分配"} · {startDate} 至 {endDate}
              </p>
            </div>
            <div className="rounded-2xl border border-white/12 bg-white/8 px-5 py-3">
              <div className="text-[10px] text-white/45">期末应收余额</div>
              <div className="mt-1 text-xl font-semibold">{currency.format(endingBalance)}</div>
            </div>
          </div>
        </section>

        {!canView ? (
          <section className="mt-5 rounded-[20px] border border-border bg-white px-6 py-16 text-center text-sm text-muted-foreground">
            当前账号无权查看客户财务对账单。
          </section>
        ) : customerResult.error || !customerResult.data ? (
          <section className="mt-5 rounded-[20px] border border-[#f0ced1] bg-[#fff7f8] px-6 py-12 text-center text-sm text-[#9e3f48]">
            客户不存在或当前账号无权读取。
          </section>
        ) : (
          <>
            <form className="mt-5 rounded-[20px] border border-[#dce6ed] bg-white p-4">
              <div className="grid gap-3 sm:grid-cols-[190px_190px_auto] sm:items-end">
                {[
                  { name: "startDate", label: "开始日期", value: startDate },
                  { name: "endDate", label: "结束日期", value: endDate },
                ].map((field) => (
                  <label className="grid gap-1.5 text-xs text-muted-foreground" key={field.name}>
                    {field.label}
                    <span className="relative">
                      <CalendarRange className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" />
                      <input
                        className="h-10 w-full rounded-xl border border-[#dce6ed] bg-[#fafcfe] pl-9 pr-3 text-sm text-foreground outline-none focus:border-[#6ba18f]"
                        defaultValue={field.value}
                        name={field.name}
                        type="date"
                      />
                    </span>
                  </label>
                ))}
                <button
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#0d7580] px-5 text-xs font-medium text-white"
                  type="submit"
                >
                  <Search className="size-4" />
                  查询对账单
                </button>
              </div>
            </form>

            {statementResult.error ? (
              <div className="mt-5 rounded-[18px] border border-[#f0ced1] bg-[#fff7f8] p-5 text-sm text-[#9e3f48]">
                对账单读取失败，请确认最新数据库迁移已执行。
              </div>
            ) : (
              <section className="mt-5 overflow-hidden rounded-[20px] border border-[#dbe5e1] bg-white">
                <div className="flex items-center justify-between border-b border-[#dfe8ef] px-5 py-4">
                  <div>
                    <h2 className="text-sm font-semibold text-[#0a385d]">应收往来明细</h2>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      借方为新增应收，贷方为收款核销
                    </p>
                  </div>
                  <ReceiptText className="size-5 text-[#4d7f71]" />
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-[980px] w-full text-xs">
                    <thead className="bg-[#256355] text-white/90">
                      <tr>
                        {["日期", "类型", "单据编号", "关联单据", "摘要", "借方（应收）", "贷方（已收）", "余额"].map((label) => (
                          <th className="whitespace-nowrap px-3 py-3 text-left font-medium" key={label}>
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, index) => (
                        <tr className="border-b border-[#e8eeeb] hover:bg-[#f5faf7]" key={`${row.document_no}-${index}`}>
                          <td className="whitespace-nowrap px-3 py-3">{row.entry_date}</td>
                          <td className="px-3 py-3">
                            <span className={`rounded-full px-2 py-1 text-[10px] ${
                              row.entry_type === "receipt"
                                ? "bg-[#eaf3f8] text-[#0d6c78]"
                                : row.entry_type === "opening"
                                  ? "bg-[#edf2f7] text-[#526b7a]"
                                  : "bg-[#fff4e7] text-[#916126]"
                            }`}>
                              {typeLabel(row.entry_type)}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 font-mono text-[11px]">{row.document_no}</td>
                          <td className="whitespace-nowrap px-3 py-3 font-mono text-[11px] text-muted-foreground">{row.source_no || "—"}</td>
                          <td className="max-w-[300px] px-3 py-3">{row.summary}</td>
                          <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">{row.debit_amount ? currency.format(row.debit_amount) : "—"}</td>
                          <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-[#0d7580]">{row.credit_amount ? currency.format(row.credit_amount) : "—"}</td>
                          <td className="whitespace-nowrap px-3 py-3 text-right font-medium tabular-nums">{currency.format(row.running_balance)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-[#f8f0df] font-semibold text-[#0a385d]">
                      <tr>
                        <td className="px-3 py-3" colSpan={5}>本期合计</td>
                        <td className="whitespace-nowrap px-3 py-3 text-right">{currency.format(debitTotal)}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-right">{currency.format(creditTotal)}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-right">{currency.format(endingBalance)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </WorkflowShell>
  );
}
