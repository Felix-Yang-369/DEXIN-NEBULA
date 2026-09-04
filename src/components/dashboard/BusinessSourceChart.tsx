"use client";

import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type {
  BusinessSourceItem,
  BusinessSummary,
} from "@/types/dashboard";

function summaryValue(item: BusinessSummary) {
  if (item.format === "currency") {
    return new Intl.NumberFormat("zh-CN", {
      style: "currency",
      currency: "CNY",
      maximumFractionDigits: 0,
    }).format(item.value);
  }
  if (item.format === "percent") {
    return `${item.value}%`;
  }
  return new Intl.NumberFormat("zh-CN").format(item.value);
}

export function BusinessSourceChart({
  data,
  summary,
}: {
  data: BusinessSourceItem[];
  summary: BusinessSummary[];
}) {
  return (
    <Card className="min-w-0 overflow-hidden bg-card transition duration-200  hover:border-border ">
      <CardHeader>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-[15px] font-semibold tracking-[-0.02em]">
              业务结构概览
            </h2>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
              订单价型
            </span>
          </div>
          <p className="mt-1 text-xs text-foreground">
            客户数量为实时数据，其余指标待销售模块接入
          </p>
        </div>
        <span className="rounded-full border border-border bg-muted px-3 py-1.5 text-xs text-foreground">
          本月
        </span>
      </CardHeader>
      <CardContent className="pt-3">
        <div className="grid items-center gap-4 sm:grid-cols-[minmax(180px,.82fr)_1fr]">
          <div className="relative mx-auto h-[210px] w-full max-w-[260px]">
            <ResponsiveContainer height="100%" width="100%">
              <PieChart>
                <Pie
                  cx="50%"
                  cy="50%"
                  data={data}
                  dataKey="value"
                  innerRadius={54}
                  nameKey="name"
                  outerRadius={82}
                  paddingAngle={0}
                  stroke="none"
                >
                  {data.map((item) => (
                    <Cell fill={item.color} key={item.name} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    boxShadow: "var(--overlay-shadow)",
                    fontSize: 12,
                  }}
                  formatter={(value) => [`${value}%`, "占比"]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
              <div>
                <div className="text-sm font-semibold text-foreground">
                  订单来源
                </div>
                <div className="mt-1 text-xs text-muted-foreground">本月占比</div>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            {data.map((item) => (
              <div
                className="grid grid-cols-[10px_1fr_auto] items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-muted"
                key={item.name}
              >
                <span
                  className="size-2.5 rounded-sm"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-foreground">{item.name}</span>
                <span className="font-medium tabular-nums text-foreground">
                  {item.value}%
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-5 sm:grid-cols-4">
          {summary.map((item) => (
            <div key={item.label}>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {item.label}
                {item.source === "demo" && (
                  <span className="rounded bg-muted px-1 text-xs text-foreground">
                    演示
                  </span>
                )}
              </div>
              <div className="mt-1 text-lg font-semibold tracking-[-0.03em]">
                {summaryValue(item)}
              </div>
              {item.trend !== null && (
                <div className="mt-1 text-xs font-medium text-foreground">
                  较上月 ↑ {item.trend}%
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
