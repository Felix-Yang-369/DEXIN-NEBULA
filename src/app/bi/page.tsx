import type { Metadata } from "next";
import Link from "next/link";
import {
  BarChart3,
  Clock3,
  DatabaseZap,
  ExternalLink,
  Gauge,
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
      breadcrumb="数据分析 / 经营分析中心"
      currentUser={{
        name: employee.name,
        roleLabel: roleLabel(employee.roleCodes) || "内部员工",
      }}
    >
      <main className="relative isolate mx-auto min-h-[calc(100svh-72px)] max-w-[1680px] overflow-hidden p-4 sm:p-6 xl:p-8">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_12%_4%,rgba(24,175,179,.12),transparent_28%),radial-gradient(circle_at_88%_16%,rgba(57,127,192,.11),transparent_30%),linear-gradient(180deg,#f4f9fc_0%,#f7f9fb_48%,#f5f8fb_100%)]" />

        <section className="relative overflow-hidden rounded-[28px] border border-white/12 bg-[radial-gradient(circle_at_79%_15%,rgba(24,175,179,.32),transparent_27%),linear-gradient(135deg,#071d34_0%,#0a2d4e_53%,#0b5264_100%)] px-6 py-7 text-white shadow-[0_28px_76px_-42px_rgba(6,24,44,.92)] sm:px-8 lg:px-10 lg:py-8">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.035)_1px,transparent_1px)] bg-[size:42px_42px] [mask-image:linear-gradient(to_right,transparent,black_55%,black)]" />
          <div className="absolute -right-12 -top-32 size-96 rounded-full border border-white/10" />
          <div className="absolute right-24 top-12 size-32 rounded-full border border-[#6bd7d4]/20" />
          <div className="absolute right-[19%] top-1/2 h-px w-48 -rotate-12 bg-gradient-to-r from-transparent via-[#6bd7d4]/50 to-transparent" />
          <BarChart3 className="pointer-events-none absolute right-10 top-1/2 hidden size-44 -translate-y-1/2 text-[#6bd7d4]/10 sm:block" />

          <div className="relative flex flex-col justify-between gap-7 xl:flex-row xl:items-end">
            <div>
              <div className="flex items-center gap-2 text-xs font-medium tracking-[0.14em] text-[#6bd7d4]">
                <Gauge className="size-4" />
                BI · BUSINESS INTELLIGENCE
              </div>
              <h1 className="mt-3 text-2xl font-semibold tracking-[-0.04em] sm:text-[32px]">
                企业经营分析中心
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/65">
                汇总 CRM、销售、仓储、财务与 HRM 的权限内数据，形成统一经营口径；当前数据不足时明确提示，不使用虚构趋势填充图表。
              </p>
            </div>

            <div className="flex flex-col gap-3 xl:items-end">
              <div className="flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-white/[0.07] p-1.5 backdrop-blur-xl">
                {PERIODS.map((item) => (
                  <Link
                    className={
                      "rounded-xl px-3.5 py-2 text-[10px] transition " +
                      (period === item.value
                        ? "bg-[#6bd7d4] font-semibold text-[#08243c] shadow-[0_8px_20px_-12px_rgba(107,215,212,.9)]"
                        : "text-white/58 hover:bg-white/10 hover:text-white")
                    }
                    href={`/bi?period=${item.value}`}
                    key={item.value}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-[10px] text-white/48">
                <span className="inline-flex items-center gap-1.5">
                  <DatabaseZap className="size-3.5 text-[#6bd7d4]" />
                  Supabase 实时聚合
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock3 className="size-3.5 text-[#6bd7d4]" />
                  更新于 {generatedTime(data.generatedAt)}
                </span>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[17px] border border-white/90 bg-white/62 px-4 py-3 text-[10px] text-[#6d8292] shadow-[0_12px_38px_-34px_rgba(7,45,76,.55)] backdrop-blur-xl sm:px-5">
          <span>
            当前视图遵循账号数据权限；时间筛选作用于销售订单与财务单据。
          </span>
          <div className="flex items-center gap-4">
            <Link className="inline-flex items-center gap-1.5 text-[#0b7182] hover:text-[#085768]" href="/finance">
              财务明细 <ExternalLink className="size-3" />
            </Link>
            <Link className="inline-flex items-center gap-1.5 text-[#0b7182] hover:text-[#085768]" href="/inventory">
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
