import type { Metadata } from "next";
import Link from "next/link";
import {
  Clock3,
  DatabaseZap,
  ExternalLink,
} from "lucide-react";
import { BiDashboard } from "@/components/bi/BiDashboard";
import { WorkflowShell } from "@/features/approvals/workflow-shell";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import { getBiData } from "@/lib/api/bi";
import type { BiPeriod } from "@/types/bi";

export const metadata: Metadata = {
  title: "数据分析 BI",
  description: "德馨星云经营、客户、库存、财务与组织分析中心",
};

export const dynamic = "force-dynamic";

const PERIODS: Array<{ value: BiPeriod; label: string }> = [
  { value: "3m", label: "近 3 个月" },
  { value: "6m", label: "近 6 个月" },
  { value: "12m", label: "近 12 个月" },
  { value: "all", label: "全部" },
];

function normalizePeriod(value: string | undefined): BiPeriod {
  return PERIODS.some((item) => item.value === value)
    ? (value as BiPeriod)
    : "6m";
}

function roleLabel(roleCodes: string[]) {
  const labels: Record<string, string> = {
    admin: "系统管理员",
    chairman: "董事长",
    hr: "人事行政",
    finance: "财务",
    department_lead: "部门负责人",
    employee: "普通员工",
  };
  return roleCodes.map((code) => labels[code]).filter(Boolean).join(" · ");
}

function generatedTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Shanghai",
  }).format(new Date(value));
}

export default async function BiPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const employee = await requireCurrentEmployee();
  const { period: periodValue } = await searchParams;
  const period = normalizePeriod(periodValue);
  const data = await getBiData(employee, period);

  return (
    <WorkflowShell
      activeItem="数据分析"
      breadcrumb="经营决策 / 数据分析 / BI"
      currentUser={{
        name: employee.name,
        roleLabel: roleLabel(employee.roleCodes) || "内部员工",
      }}
    >
      <main className="relative isolate mx-auto min-h-[calc(100svh-72px)] max-w-[1440px] overflow-hidden p-4 sm:p-6 xl:p-8">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-card" />

        <section className="ui-page-header">
          <div className="relative flex flex-col justify-between gap-7 xl:flex-row xl:items-end">
            <div>
              <h1>
                企业经营分析中心
              </h1>
              <p className="mt-2 max-w-2xl">
                汇总 CRM、销售、仓储、财务与 HRM 的权限内数据，形成统一经营口径；当前数据不足时明确提示，不使用虚构趋势填充图表。
              </p>
            </div>

            <div className="flex flex-col gap-3 xl:items-end">
              <div className="flex flex-wrap gap-1 rounded-sm border border-border bg-muted p-1">
                {PERIODS.map((item) => (
                  <Link
                    className={
                      "rounded-sm px-3.5 py-2 text-xs transition-colors " +
                      (period === item.value
                        ? "bg-white font-semibold text-foreground"
                        : "text-muted-foreground hover:bg-white")
                    }
                    href={`/bi?period=${item.value}`}
                    key={item.value}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-white/48">
                <span className="inline-flex items-center gap-1.5">
                  <DatabaseZap className="size-3.5 text-muted-foreground" />
                  Supabase 实时聚合
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock3 className="size-3.5 text-muted-foreground" />
                  更新于 {generatedTime(data.generatedAt)}
                </span>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-md border border-white/90 bg-white/62 px-4 py-3 text-xs text-foreground  backdrop-blur-xl sm:px-5">
          <span>
            当前视图遵循账号数据权限；时间筛选作用于销售订单与财务单据。
          </span>
          <div className="flex items-center gap-4">
            <Link className="inline-flex items-center gap-1.5 text-foreground hover:text-foreground" href="/finance">
              财务明细 <ExternalLink className="size-3" />
            </Link>
            <Link className="inline-flex items-center gap-1.5 text-foreground hover:text-foreground" href="/inventory">
              库存明细 <ExternalLink className="size-3" />
            </Link>
          </div>
        </div>

        <div className="mt-6">
          <BiDashboard data={data} />
        </div>
      </main>
    </WorkflowShell>
  );
}
