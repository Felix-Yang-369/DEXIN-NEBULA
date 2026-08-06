import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Calculator,
  CircleAlert,
  CircleDollarSign,
  SlidersHorizontal,
  Target,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import { WorkflowShell } from "@/features/approvals/workflow-shell";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import { savePerformancePlanAction } from "@/features/hr/performance-actions";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "绩效考核中心",
  description: "按员工配置差异化指标，并联动 CRM 与财务数据完成月度绩效测算",
};

export const dynamic = "force-dynamic";

type PerformanceMetric = {
  code: string;
  name: string;
  unit: string;
  weightPercent: number | null;
  targetValue: number | null;
  formulaNote: string;
  value: number | null;
};

type PerformanceRow = {
  employeeId: string;
  employeeNo: string;
  employeeName: string;
  departmentName: string;
  planId: string | null;
  planName: string | null;
  baseSalary: number | null;
  commissionRate: number;
  operatingRevenue: number;
  salesCurrent: number;
  salesPrevious: number;
  salesIncrement: number;
  profitCurrent: number;
  profitPrevious: number;
  profitIncrement: number;
  variablePay: number;
  estimatedCompensation: number | null;
  metrics: PerformanceMetric[];
};

type EmployeeOption = {
  id: string;
  employee_no: string;
  name: string;
  departments: { name: string } | Array<{ name: string }> | null;
};

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

function shanghaiMonth() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
  }).format(new Date());
}

function normalizedMonth(value?: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value ?? "")
    ? String(value)
    : shanghaiMonth();
}

function shiftedMonth(month: string, offset: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month: string) {
  const [year, monthNumber] = month.split("-");
  return `${year}年${Number(monthNumber)}月`;
}

function roleLabel(roleCodes: string[], title: string | null) {
  if (roleCodes.includes("chairman")) return "董事长";
  if (roleCodes.includes("hr")) return "人力资源";
  if (roleCodes.includes("finance")) return "财务";
  return title ?? "员工";
}

function parseMetrics(value: unknown): PerformanceMetric[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const metric = item as Record<string, unknown>;
    return {
      code: String(metric.code ?? ""),
      name: String(metric.name ?? "未命名指标"),
      unit: String(metric.unit ?? "元"),
      weightPercent:
        metric.weightPercent == null ? null : Number(metric.weightPercent),
      targetValue: metric.targetValue == null ? null : Number(metric.targetValue),
      formulaNote: String(metric.formulaNote ?? ""),
      value: metric.value == null ? null : Number(metric.value),
    };
  });
}

function parseRows(value: unknown): PerformanceRow[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const row = item as Record<string, unknown>;
    return {
      employeeId: String(row.employee_id ?? ""),
      employeeNo: String(row.employee_no ?? ""),
      employeeName: String(row.employee_name ?? "未命名员工"),
      departmentName: String(row.department_name ?? "未分配部门"),
      planId: row.plan_id ? String(row.plan_id) : null,
      planName: row.plan_name ? String(row.plan_name) : null,
      baseSalary:
        row.base_salary_cny == null ? null : Number(row.base_salary_cny),
      commissionRate: Number(row.revenue_commission_rate ?? 0),
      operatingRevenue: Number(row.monthly_operating_revenue ?? 0),
      salesCurrent: Number(row.crm_sales_current ?? 0),
      salesPrevious: Number(row.crm_sales_previous ?? 0),
      salesIncrement: Number(row.crm_sales_increment ?? 0),
      profitCurrent: Number(row.crm_profit_current ?? 0),
      profitPrevious: Number(row.crm_profit_previous ?? 0),
      profitIncrement: Number(row.crm_profit_increment ?? 0),
      variablePay: Number(row.estimated_variable_pay ?? 0),
      estimatedCompensation:
        row.estimated_total_compensation == null
          ? null
          : Number(row.estimated_total_compensation),
      metrics: parseMetrics(row.metrics),
    };
  });
}

function metricValue(metric: PerformanceMetric) {
  if (metric.value == null) return "待人工录入";
  return currency.format(metric.value);
}

function MetricCard({
  title,
  value,
  note,
  icon,
}: {
  title: string;
  value: string;
  note: string;
  icon: React.ReactNode;
}) {
  return (
    <article className="rounded-[18px] border border-border/75 bg-white p-5 shadow-[0_8px_24px_rgba(14,62,52,0.035)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] text-muted-foreground">{title}</div>
          <div className="mt-2 text-xl font-semibold tracking-[-0.035em] text-[#0a385d]">
            {value}
          </div>
        </div>
        <span className="grid size-10 place-items-center rounded-xl bg-[#eaf3f8] text-[#0d6c78]">
          {icon}
        </span>
      </div>
      <div className="mt-4 border-t border-border/70 pt-3 text-[9px] text-muted-foreground">
        {note}
      </div>
    </article>
  );
}

export default async function PerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; error?: string; saved?: string }>;
}) {
  const currentEmployee = await requireCurrentEmployee();
  const query = await searchParams;
  const month = normalizedMonth(query.month);
  const supabase = await createClient();
  const canConfigure = currentEmployee.roleCodes.some((role) =>
    ["hr", "admin", "chairman"].includes(role),
  );
  const canSeeTeam = currentEmployee.roleCodes.some((role) =>
    ["hr", "finance", "admin", "chairman"].includes(role),
  );

  const [summaryResult, employeeResult] = await Promise.all([
    supabase.rpc("hr_performance_monthly_summary", {
      p_month: `${month}-01`,
    }),
    canConfigure
      ? supabase
          .from("employees")
          .select("id, employee_no, name, departments(name)")
          .eq("organization_id", currentEmployee.organizationId)
          .eq("status", "active")
          .order("employee_no")
      : Promise.resolve({ data: [], error: null }),
  ]);

  const rows = parseRows(summaryResult.data);
  const employeeOptions = (employeeResult.data ?? []) as EmployeeOption[];
  const configuredRows = rows.filter((row) => row.planId);
  const totalSalesIncrement = configuredRows.reduce(
    (sum, row) => sum + row.salesIncrement,
    0,
  );
  const totalProfitIncrement = configuredRows.reduce(
    (sum, row) => sum + row.profitIncrement,
    0,
  );
  const payrollEstimate = configuredRows.reduce(
    (sum, row) => sum + (row.estimatedCompensation ?? 0),
    0,
  );
  const operatingRevenue = Math.max(
    0,
    ...configuredRows.map((row) => row.operatingRevenue),
  );

  return (
    <WorkflowShell
      activeItem="人力资源"
      breadcrumb="人力资源 / 绩效考核"
      currentUser={{
        name: currentEmployee.name,
        roleLabel: roleLabel(currentEmployee.roleCodes, currentEmployee.title),
      }}
    >
      <main className="mx-auto max-w-[1600px] p-4 sm:p-6 xl:p-8">
        <section className="relative overflow-hidden rounded-[24px] bg-[#0a385d] px-6 py-8 text-white sm:px-8 lg:px-10">
          <div className="absolute -right-20 -top-24 size-80 rounded-full border border-white/8" />
          <Target className="absolute right-12 top-1/2 hidden size-40 -translate-y-1/2 text-white/[0.05] sm:block" />
          <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <div className="text-[10px] font-medium tracking-[0.16em] text-[#79d8d5]">
                HRM · INDIVIDUAL PERFORMANCE
              </div>
              <h1 className="mt-3 text-2xl font-semibold tracking-[-0.035em] sm:text-[30px]">
                绩效考核中心
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-white/55">
                每位员工独立配置考核口径。客服团队联动 CRM 负责客户的销售与预计利润增量，财务等岗位可按营业收入或岗位职责设置指标。
              </p>
            </div>
            <Link
              className="inline-flex h-10 items-center rounded-xl bg-white px-4 text-xs font-medium text-[#0b3a5d]"
              href="/customers"
            >
              管理 CRM 客户归属
            </Link>
          </div>
        </section>

        <section className="mt-5 flex flex-col justify-between gap-3 rounded-[18px] border border-border/75 bg-white p-4 sm:flex-row sm:items-center">
          <div>
            <div className="text-xs font-medium">{monthLabel(month)}</div>
            <div className="mt-1 text-[10px] text-muted-foreground">
              绩效结果随 CRM 报价状态和财务确认收入实时重算
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border px-3 text-[10px] text-muted-foreground hover:bg-muted" href={`/hr/performance?month=${shiftedMonth(month, -1)}`}>
              <ArrowLeft className="size-3.5" />上月
            </Link>
            <Link className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border px-3 text-[10px] text-muted-foreground hover:bg-muted" href={`/hr/performance?month=${shiftedMonth(month, 1)}`}>
              下月<ArrowRight className="size-3.5" />
            </Link>
          </div>
        </section>

        {query.saved ? (
          <div className="mt-5 flex items-center gap-2 rounded-[14px] border border-[#cfe5da] bg-[#eef8f3] px-4 py-3 text-xs text-[#0d6c78]">
            <BadgeCheck className="size-4" />绩效方案已保存并开始按生效月份计算。
          </div>
        ) : null}
        {query.error ? (
          <div className="mt-5 flex items-center gap-2 rounded-[14px] border border-[#edd3ce] bg-[#fff4f1] px-4 py-3 text-xs text-[#9a564a]" role="alert">
            <CircleAlert className="size-4" />{query.error}
          </div>
        ) : null}

        {summaryResult.error ? (
          <section className="mt-5 rounded-[20px] border border-[#eed3cd] bg-[#fff4f1] px-6 py-12 text-center">
            <CircleAlert className="mx-auto size-8 text-[#a65548]" />
            <h2 className="mt-3 text-sm font-semibold text-[#8f4d42]">暂时无法读取绩效数据</h2>
            <p className="mt-2 text-xs text-[#a96a5f]">请确认绩效考核数据库迁移已经执行。</p>
          </section>
        ) : (
          <>
            <section className={`mt-5 grid gap-4 sm:grid-cols-2 ${canSeeTeam ? "xl:grid-cols-4" : "xl:grid-cols-3"}`}>
              <MetricCard icon={<UsersRound className="size-5" />} note={canSeeTeam ? `${rows.length} 位在职员工` : "仅展示本人"} title="已配置方案" value={`${configuredRows.length} 份`} />
              <MetricCard icon={totalSalesIncrement >= 0 ? <ArrowUpRight className="size-5" /> : <ArrowDownRight className="size-5" />} note="负责客户本月已接受报价－上月" title="CRM 销售增量" value={compactCurrency.format(totalSalesIncrement)} />
              <MetricCard icon={<TrendingUp className="size-5" />} note="报价销售额减有效采购价的预计值" title="CRM 预计利润增量" value={compactCurrency.format(totalProfitIncrement)} />
              {canSeeTeam ? <MetricCard icon={<CircleDollarSign className="size-5" />} note={`已确认收入 ${compactCurrency.format(operatingRevenue)}`} title="月度薪酬测算" value={compactCurrency.format(payrollEstimate)} /> : null}
            </section>

            <section className="mt-5 space-y-4">
              {rows.map((row) => (
                <article className="overflow-hidden rounded-[20px] border border-border/75 bg-white shadow-[0_8px_28px_rgba(14,62,52,0.035)]" key={row.employeeId}>
                  <div className="flex flex-col justify-between gap-4 border-b border-border/70 px-5 py-4 sm:flex-row sm:items-center sm:px-6">
                    <div className="flex items-center gap-3">
                      <span className="grid size-10 place-items-center rounded-xl bg-[#eaf3f8] font-semibold text-[#0d6c78]">{row.employeeName.slice(0, 1)}</span>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Link className="text-sm font-semibold text-[#0a385d]" href={`/employees/${row.employeeId}`}>{row.employeeName}</Link>
                          <span className="rounded-full bg-[#f0f4f2] px-2 py-1 text-[9px] text-muted-foreground">{row.departmentName}</span>
                        </div>
                        <div className="mt-1 font-mono text-[9px] text-muted-foreground">{row.employeeNo}</div>
                      </div>
                    </div>
                    <div className="sm:text-right">
                      <div className="text-xs font-medium text-[#244a42]">{row.planName ?? "尚未配置个人绩效方案"}</div>
                      <div className="mt-1 text-[9px] text-muted-foreground">{row.planId ? `${row.metrics.length} 项考核指标` : "由 HR 或管理员配置"}</div>
                    </div>
                  </div>

                  {row.planId ? (
                    <div className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_300px] lg:p-6">
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {row.metrics.map((metric) => {
                          const completion = metric.targetValue && metric.value != null && metric.targetValue !== 0 ? (metric.value / metric.targetValue) * 100 : null;
                          return (
                            <div className="rounded-[16px] border border-border/70 bg-[#fbfcfb] p-4" key={metric.code}>
                              <div className="flex items-start justify-between gap-2">
                                <div className="text-[10px] text-muted-foreground">{metric.name}</div>
                                {metric.weightPercent != null ? <span className="rounded-full bg-[#eaf3f8] px-2 py-1 text-[8px] text-[#0d6c78]">权重 {metric.weightPercent}%</span> : null}
                              </div>
                              <div className={`mt-2 text-lg font-semibold tabular-nums ${metric.value != null && metric.value < 0 ? "text-[#bd5b64]" : "text-[#0a385d]"}`}>{metricValue(metric)}</div>
                              <div className="mt-2 text-[9px] leading-5 text-muted-foreground">{metric.targetValue == null ? "未设置目标值，不自动生成分数" : `目标 ${currency.format(metric.targetValue)}${completion == null ? "" : ` · 完成 ${completion.toFixed(1)}%`}`}</div>
                              <div className="mt-3 border-t border-border/60 pt-3 text-[9px] leading-5 text-muted-foreground">{metric.formulaNote}</div>
                            </div>
                          );
                        })}
                      </div>
                      <aside className="rounded-[18px] bg-[#0a385d] p-5 text-white">
                        <div className="flex items-center gap-2 text-[10px] text-white/55"><Calculator className="size-3.5" />薪酬关联测算</div>
                        {row.baseSalary == null ? (
                          <div className="mt-5 text-xs leading-6 text-white/60">当前方案只考核业务指标，尚未配置底薪或提成规则。</div>
                        ) : (
                          <>
                            <div className="mt-4 text-xl font-semibold">{currency.format(row.estimatedCompensation ?? 0)}</div>
                            <div className="mt-3 rounded-xl bg-white/[0.07] p-3 text-[9px] leading-5 text-white/60">
                              {currency.format(row.baseSalary)} + {currency.format(row.operatingRevenue)} × {(row.commissionRate * 10_000).toFixed(4).replace(/\.?0+$/, "")}‱
                              <br />浮动测算：{currency.format(row.variablePay)}
                            </div>
                          </>
                        )}
                        <div className="mt-4 border-t border-white/10 pt-3 text-[8px] leading-4 text-white/40">仅为规则测算，不是工资条，也不替代财务复核。</div>
                      </aside>
                    </div>
                  ) : (
                    <div className="px-6 py-8 text-center text-xs text-muted-foreground">暂无指标。配置后可按该员工岗位显示独立考核内容。</div>
                  )}
                </article>
              ))}
            </section>
          </>
        )}

        {canConfigure ? (
          <section className="mt-5 overflow-hidden rounded-[20px] border border-border/75 bg-white" id="configure">
            <div className="flex items-center gap-3 border-b border-border/70 px-5 py-4 sm:px-6">
              <span className="grid size-10 place-items-center rounded-xl bg-[#eaf3f8] text-[#0d6c78]"><SlidersHorizontal className="size-5" /></span>
              <div><h2 className="text-sm font-semibold">配置个人绩效方案</h2><p className="mt-1 text-[10px] text-muted-foreground">每位员工可使用不同指标；目标留空时只展示实际值，不自动评分。</p></div>
            </div>
            <form action={savePerformancePlanAction} className="grid gap-5 p-5 sm:grid-cols-2 lg:grid-cols-4 lg:p-6">
              <label className="block"><span className="text-[10px] font-medium">员工</span><select className="mt-2 h-10 w-full rounded-xl border border-border bg-white px-3 text-xs" name="employeeId" required><option value="">请选择员工</option>{employeeOptions.map((employee) => { const department = Array.isArray(employee.departments) ? employee.departments[0] : employee.departments; return <option key={employee.id} value={employee.id}>{employee.name} · {department?.name ?? "未分配部门"}</option>; })}</select></label>
              <label className="block"><span className="text-[10px] font-medium">方案名称</span><input className="mt-2 h-10 w-full rounded-xl border border-border px-3 text-xs" maxLength={80} name="planName" placeholder="例如：客服客户经营绩效" required /></label>
              <label className="block"><span className="text-[10px] font-medium">底薪（元，可留空）</span><input className="mt-2 h-10 w-full rounded-xl border border-border px-3 text-xs" min="0" name="baseSalary" placeholder="未关联薪酬时留空" step="0.01" type="number" /></label>
              <label className="block"><span className="text-[10px] font-medium">营收提成（万分之几）</span><input className="mt-2 h-10 w-full rounded-xl border border-border px-3 text-xs" defaultValue="0" min="0" name="revenueCommissionWanfen" step="0.0001" type="number" /></label>
              <label className="block"><span className="text-[10px] font-medium">生效日期</span><input className="mt-2 h-10 w-full rounded-xl border border-border px-3 text-xs" defaultValue={`${month}-01`} name="effectiveFrom" required type="date" /></label>
              <div className="sm:col-span-2 lg:col-span-3"><div className="text-[10px] font-medium">考核指标与目标</div><div className="mt-2 grid gap-3 md:grid-cols-3">
                <label className="rounded-xl border border-border p-3 text-[10px]"><span className="flex items-center gap-2"><input defaultChecked name="metricCodes" type="checkbox" value="crm_sales_increment" />负责客户销售增量</span><input className="mt-3 h-9 w-full rounded-lg border border-border px-3" name="salesTarget" placeholder="目标值，可留空" step="0.01" type="number" /></label>
                <label className="rounded-xl border border-border p-3 text-[10px]"><span className="flex items-center gap-2"><input defaultChecked name="metricCodes" type="checkbox" value="crm_profit_increment" />负责客户预计利润增量</span><input className="mt-3 h-9 w-full rounded-lg border border-border px-3" name="profitTarget" placeholder="目标值，可留空" step="0.01" type="number" /></label>
                <label className="rounded-xl border border-border p-3 text-[10px]"><span className="flex items-center gap-2"><input name="metricCodes" type="checkbox" value="monthly_operating_revenue" />公司月度营业收入</span><input className="mt-3 h-9 w-full rounded-lg border border-border px-3" name="revenueTarget" placeholder="目标值，可留空" step="0.01" type="number" /></label>
              </div></div>
              <div className="flex items-end justify-between gap-4 border-t border-border/70 pt-5 sm:col-span-2 lg:col-span-4"><p className="max-w-3xl text-[9px] leading-5 text-muted-foreground">营业收入当前按财务中心“已确认收入流水”汇总；CRM 利润为报价预计毛利。正式计薪前必须由 HR 与财务复核。</p><button className="h-10 shrink-0 rounded-xl bg-[#0a385d] px-5 text-xs font-medium text-white" type="submit">保存方案</button></div>
            </form>
          </section>
        ) : null}

        <section className="mt-5 flex items-start gap-3 rounded-[18px] border border-[#e6d6b8] bg-[#fff9ef] p-5">
          <CircleAlert className="mt-0.5 size-5 shrink-0 text-[#94601f]" />
          <div className="text-[10px] leading-6 text-[#805b29]">当前 CRM 利润指标按已接受报价减产品有效采购价测算，不含退货、运费、税费等最终结算差异；月度营业收入暂按已确认收入流水统计。以上数据用于经营绩效参考，不等同于会计利润、工资条或最终薪资。</div>
        </section>
      </main>
    </WorkflowShell>
  );
}
