"use client";

import {
  ClipboardCheck,
  PackageSearch,
  ReceiptText,
  ShoppingCart,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { Line, LineChart, ResponsiveContainer } from "recharts";
import { Card } from "@/components/ui/card";
import type {
  DashboardKpi,
  DashboardKpiKey,
} from "@/types/dashboard";

const KPI_VISUALS: Record<
  DashboardKpiKey,
  { icon: LucideIcon; tone: string; line: string; accent: string; surface: string }
> = {
  sales: {
    icon: ShoppingCart,
    tone: "bg-[#dff5f4] text-[#0d7580]",
    line: "#18afb3",
    accent: "from-[#18afb3] to-[#6bd7d4]",
    surface: "from-[#f3fbfc] to-white",
  },
  orders: {
    icon: ReceiptText,
    tone: "bg-[#eaf1fb] text-[#4773b8]",
    line: "#5687cf",
    accent: "from-[#5687cf] to-[#91afe0]",
    surface: "from-[#f7faff] to-white",
  },
  approvals: {
    icon: ClipboardCheck,
    tone: "bg-[#fff3e1] text-[#c4832e]",
    line: "#e3a94f",
    accent: "from-[#e3a94f] to-[#efce8a]",
    surface: "from-[#fffbf4] to-white",
  },
  inventory: {
    icon: PackageSearch,
    tone: "bg-[#fff0f1] text-[#d6626c]",
    line: "#ef6b73",
    accent: "from-[#ef6b73] to-[#f3a0a6]",
    surface: "from-[#fff8f8] to-white",
  },
  online: {
    icon: UsersRound,
    tone: "bg-[#e8f1f8] text-[#1a5b86]",
    line: "#397fc0",
    accent: "from-[#397fc0] to-[#86b5df]",
    surface: "from-[#f5f9fd] to-white",
  },
};

function formatKpiValue(kpi: DashboardKpi) {
  if (kpi.value === null) {
    return "—";
  }
  if (kpi.format === "currency") {
    return new Intl.NumberFormat("zh-CN", {
      style: "currency",
      currency: "CNY",
      maximumFractionDigits: 0,
    }).format(kpi.value);
  }
  return new Intl.NumberFormat("zh-CN").format(kpi.value);
}

export function KPIOverview({ items }: { items: DashboardKpi[] }) {
  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-12">
      {items.map((item) => {
        const visual = KPI_VISUALS[item.key];
        const Icon = visual.icon;
        const sparkline = item.sparkline.map((value, index) => ({
          index,
          value,
        }));
        const gridSpan =
          item.key === "sales" || item.key === "orders"
            ? "xl:col-span-3"
            : "xl:col-span-2";
        return (
          <Card
            className={`group relative min-w-0 overflow-hidden border-white/90 bg-gradient-to-br p-5 shadow-[0_16px_44px_-34px_rgba(9,57,91,.55)] transition duration-300 hover:-translate-y-1 hover:border-white hover:shadow-[0_24px_50px_-32px_rgba(9,57,91,.42)] ${gridSpan} ${visual.surface}`}
            key={item.key}
          >
            <span
              aria-hidden="true"
              className="absolute -right-12 -top-14 size-32 rounded-full bg-white/75 blur-2xl transition-transform duration-500 group-hover:scale-125"
            />
            <span
              aria-hidden="true"
              className={`absolute inset-x-5 top-0 h-[2px] rounded-b-full bg-gradient-to-r ${visual.accent}`}
            />
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-xs font-medium text-[#5f7283]">
                    {item.title}
                  </span>
                  {item.source === "demo" && (
                    <span className="rounded-full bg-[#fff4e3] px-1.5 py-0.5 text-[8px] font-medium text-[#a8752c]">
                      演示
                    </span>
                  )}
                </div>
                <div className="mt-3 truncate text-[29px] font-semibold tracking-[-0.05em] text-[#132b42]">
                  {formatKpiValue(item)}
                </div>
              </div>
              <span className={`grid size-10 shrink-0 place-items-center rounded-[14px] shadow-[inset_0_0_0_1px_rgba(255,255,255,.4)] transition-transform duration-200 group-hover:scale-105 ${visual.tone}`}>
                <Icon className="size-[18px] stroke-[1.8]" />
              </span>
            </div>

            <div className="mt-3 flex h-7 items-center justify-between gap-2">
              <div className="min-w-0 text-[10px]">
                <span className="text-[#7d8f9e]">{item.trendLabel}</span>
                {item.trend !== null && (
                  <span className="ml-1.5 font-medium text-[#0d926f]">
                    ↑ {item.trend}%
                  </span>
                )}
              </div>
              <div className="h-9 w-24 shrink-0 rounded-xl border border-white/80 bg-white/60 px-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,.7)]">
                <ResponsiveContainer height="100%" width="100%">
                  <LineChart data={sparkline}>
                    <Line
                      dataKey="value"
                      dot={false}
                      isAnimationActive={false}
                      stroke={visual.line}
                      strokeWidth={1.8}
                      type="monotone"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="mt-2 truncate border-t border-[#eaf0f4] pt-3 text-[9px] text-[#8293a1]">
              {item.note}
            </div>
          </Card>
        );
      })}
    </section>
  );
}
