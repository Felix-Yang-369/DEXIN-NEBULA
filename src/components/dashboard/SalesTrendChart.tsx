"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { SalesTrendPoint } from "@/types/dashboard";

export function SalesTrendChart({ data }: { data: SalesTrendPoint[] }) {
  const total = data.reduce((sum, item) => sum + item.sales * 10000, 0);

  return (
    <Card className="min-w-0 overflow-hidden bg-[linear-gradient(145deg,#ffffff_0%,#ffffff_68%,#f5f9fc_100%)] transition duration-200 hover:-translate-y-0.5 hover:border-[#d7e4ec] hover:shadow-[0_16px_42px_rgba(10,57,91,.075)]">
      <CardHeader>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-[15px] font-semibold tracking-[-0.02em]">
              销售趋势分析
            </h2>
            <span className="rounded-full bg-[#fff4e3] px-2 py-0.5 text-[8px] font-medium text-[#a8752c]">
              实时数据
            </span>
          </div>
          <p className="mt-1 text-[10px] text-[#8293a1]">
            基于权限范围内的非取消销售订单
          </p>
        </div>
        <span className="rounded-full border border-[#e4ebe8] bg-[#f8fafc] px-3 py-1.5 text-[10px] text-[#596862]">
          近 7 天
        </span>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="mb-4 flex items-end gap-4">
          <div>
            <div className="text-[10px] text-[#8293a1]">销售额（元）</div>
            <div className="mt-1 text-xl font-semibold tracking-[-0.035em]">
              {new Intl.NumberFormat("zh-CN", {
                style: "currency",
                currency: "CNY",
                maximumFractionDigits: 0,
              }).format(total)}
            </div>
          </div>
          <div className="pb-0.5 text-[10px] font-medium text-[#0b8c6e]">权限内实时汇总</div>
        </div>
        <div className="h-[250px] w-full">
          {data.length > 0 ? (
            <ResponsiveContainer height="100%" width="100%">
              <ComposedChart
                data={data}
                margin={{ bottom: 0, left: -18, right: -12, top: 8 }}
              >
                <CartesianGrid
                  stroke="#e8eef3"
                  strokeDasharray="3 4"
                  vertical={false}
                />
                <XAxis
                  axisLine={false}
                  dataKey="date"
                  fontSize={10}
                  tick={{ fill: "#81908b" }}
                  tickLine={false}
                />
                <YAxis
                  axisLine={false}
                  fontSize={9}
                  tick={{ fill: "#98a39f" }}
                  tickFormatter={(value) => `${value}万`}
                  tickLine={false}
                  yAxisId="sales"
                />
                <YAxis
                  axisLine={false}
                  fontSize={9}
                  hide
                  orientation="right"
                  tickLine={false}
                  yAxisId="orders"
                />
                <Tooltip
                  contentStyle={{
                    border: "1px solid #dce6ed",
                    borderRadius: 14,
                    boxShadow: "0 12px 30px rgba(0,0,0,.08)",
                    fontSize: 11,
                  }}
                  formatter={(value, name) =>
                    name === "销售额"
                      ? [`${value} 万元`, name]
                      : [`${value} 单`, name]
                  }
                />
                <Bar
                  dataKey="sales"
                  fill="#0d6475"
                  name="销售额"
                  radius={[5, 5, 0, 0]}
                  yAxisId="sales"
                />
                <Line
                  dataKey="orders"
                  dot={{ fill: "#e1a846", r: 2.5, strokeWidth: 0 }}
                  name="订单数"
                  stroke="#e1a846"
                  strokeWidth={2}
                  type="monotone"
                  yAxisId="orders"
                />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="grid h-full place-items-center text-xs text-[#8293a1]">
              暂无销售趋势数据
            </div>
          )}
        </div>
        <div className="mt-2 flex justify-center gap-6 text-[10px] text-[#66746f]">
          <span className="inline-flex items-center gap-2">
            <i className="size-2.5 rounded-full bg-[#0d6475]" />
            销售额
          </span>
          <span className="inline-flex items-center gap-2">
            <i className="size-2.5 rounded-full bg-[#e1a846]" />
            订单数
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
