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
  { icon: LucideIcon; accent: string; surface: string; chart: string }
> = {
  sales: {
    icon: ShoppingCart,
    accent: "border-l-primary text-primary",
    surface: "bg-primary/5",
    chart: "var(--chart-1)",
  },
  orders: {
    icon: ReceiptText,
    accent: "border-l-info text-info",
    surface: "bg-info-surface/70",
    chart: "var(--chart-3)",
  },
  approvals: {
    icon: ClipboardCheck,
    accent: "border-l-attention text-attention",
    surface: "bg-attention-surface/70",
    chart: "var(--attention)",
  },
  inventory: {
    icon: PackageSearch,
    accent: "border-l-intelligence text-intelligence",
    surface: "bg-intelligence-surface/70",
    chart: "var(--chart-4)",
  },
  online: {
    icon: UsersRound,
    accent: "border-l-success text-success",
    surface: "bg-success-surface/70",
    chart: "var(--success)",
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
        const trendPositive = item.trend !== null && item.trend >= 0;
        return (
          <Card
            className={`min-w-0 border-l-2 border-border p-4 ${visual.accent} ${visual.surface} ${gridSpan}`}
            key={item.key}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-xs font-medium text-muted-foreground">
                    {item.title}
                  </span>
                  {item.source === "demo" && (
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                      演示
                    </span>
                  )}
                </div>
                <div className="mt-3 truncate text-[29px] font-semibold tracking-[-0.05em] text-foreground">
                  {formatKpiValue(item)}
                </div>
              </div>
              <span className={visual.accent.split(" ").at(-1)}>
                <Icon className="size-5 stroke-[1.8]" />
              </span>
            </div>

            <div className="mt-3 flex h-7 items-center justify-between gap-2">
              <div className="min-w-0 text-xs">
                <span className="text-muted-foreground">{item.trendLabel}</span>
                {item.trend !== null && (
                  <span
                    className={`ml-1.5 font-medium ${trendPositive ? "text-success" : "text-danger"}`}
                  >
                    {trendPositive ? "↑" : "↓"} {Math.abs(item.trend)}%
                  </span>
                )}
              </div>
              <div className="h-9 w-24 shrink-0 border-l border-border pl-2">
                <ResponsiveContainer height="100%" width="100%">
                  <LineChart data={sparkline}>
                    <Line
                      dataKey="value"
                      dot={false}
                      isAnimationActive={false}
                      stroke={visual.chart}
                      strokeWidth={1.8}
                      type="monotone"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="mt-2 truncate border-t border-border pt-3 text-xs text-muted-foreground">
              {item.note}
            </div>
          </Card>
        );
      })}
    </section>
  );
}
