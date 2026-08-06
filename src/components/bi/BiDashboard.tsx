"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Boxes,
  CircleDollarSign,
  PackageSearch,
  ShoppingCart,
  TriangleAlert,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import type { BiData, BiKpi } from "@/types/bi";

const COLORS = ["#0b7182", "#3d82b8", "#d5a646", "#91a9b8", "#9dcac7"];
const KPI_ICONS: Record<BiKpi["key"], LucideIcon> = {
  customers: UsersRound,
  receivables: CircleDollarSign,
  orders: ShoppingCart,
  inventory: Boxes,
  warnings: TriangleAlert,
  employees: PackageSearch,
};
const KPI_TONES: Record<BiKpi["key"], string> = {
  customers: "bg-[#def3f2] text-[#087681]",
  receivables: "bg-[#e8f0fb] text-[#4775b5]",
  orders: "bg-[#e9f5ee] text-[#217b62]",
  inventory: "bg-[#eef2f6] text-[#49677e]",
  warnings: "bg-[#fff1e2] text-[#b87524]",
  employees: "bg-[#f1ebf8] text-[#775da1]",
};
const card =
  "overflow-hidden rounded-[22px] border border-white/90 bg-white/82 shadow-[0_18px_54px_-40px_rgba(7,45,76,.58)] backdrop-blur-xl";

function money(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    maximumFractionDigits: 0,
  }).format(value);
}

function kpiValue(item: BiKpi) {
  if (!item.sourceAvailable) return "—";
  return item.format === "currency"
    ? money(item.value)
    : new Intl.NumberFormat("zh-CN").format(item.value);
}

function ChartHeader({
  title,
  subtitle,
  badge,
}: {
  title: string;
  subtitle: string;
  badge?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 pt-5 sm:px-6 sm:pt-6">
      <div>
        <h2 className="text-[15px] font-semibold tracking-[-0.025em] text-[#18344d]">
          {title}
        </h2>
        <p className="mt-1 text-[10px] text-[#7d8f9f]">{subtitle}</p>
      </div>
      {badge && (
        <span className="rounded-full border border-[#dce8ed] bg-[#f6f9fb] px-3 py-1.5 text-[9px] text-[#637787]">
          {badge}
        </span>
      )}
    </div>
  );
}

export function BiDashboard({ data }: { data: BiData }) {
  const customerTotal = data.customerLevels.reduce(
    (sum, item) => sum + item.value,
    0,
  );
  const agingTotal = data.receivableAging.reduce(
    (sum, item) => sum + item.value,
    0,
  );
  const maxRanking = Math.max(
    1,
    ...data.receivableRanking.map((item) => item.outstanding),
  );

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        {data.kpis.map((item) => {
          const Icon = KPI_ICONS[item.key];
          return (
            <article
              className="group relative overflow-hidden rounded-[20px] border border-white/90 bg-white/85 p-5 shadow-[0_16px_46px_-36px_rgba(7,45,76,.58)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_55px_-35px_rgba(7,45,76,.42)]"
              key={item.key}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[10px] font-medium text-[#708495]">
                    {item.label}
                  </div>
                  <div className="mt-3 truncate text-[25px] font-semibold tracking-[-0.045em] text-[#142d43]">
                    {kpiValue(item)}
                  </div>
                </div>
                <span
                  className={
                    "grid size-10 shrink-0 place-items-center rounded-[14px] " +
                    KPI_TONES[item.key]
                  }
                >
                  <Icon className="size-[18px]" />
                </span>
              </div>
              <div className="mt-4 border-t border-[#e8eef2] pt-3 text-[9px] leading-4 text-[#8798a6]">
                {item.note}
              </div>
            </article>
          );
        })}
      </section>

      {data.warnings.length > 0 && (
        <section className="grid gap-2 rounded-[18px] border border-[#ecdcbf] bg-[#fffaf0]/90 px-4 py-3 text-[10px] leading-5 text-[#8a642e] sm:grid-cols-2">
          {data.warnings.map((warning) => (
            <div className="flex gap-2" key={warning}>
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
              <span>{warning}</span>
            </div>
          ))}
        </section>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,.82fr)_minmax(0,1.18fr)]">
        <section className={card}>
          <ChartHeader
            badge={customerTotal + " 家"}
            subtitle="当前客户主档，按 S / A / B / C 分级"
            title="客户等级结构"
          />
          <div className="grid items-center gap-3 px-5 pb-6 pt-3 sm:grid-cols-[210px_1fr]">
            <div className="relative mx-auto h-[220px] w-full max-w-[240px]">
              <ResponsiveContainer height="100%" width="100%">
                <PieChart>
                  <Pie
                    cx="50%"
                    cy="50%"
                    data={data.customerLevels}
                    dataKey="value"
                    innerRadius={60}
                    outerRadius={86}
                    paddingAngle={3}
                    stroke="none"
                  >
                    {data.customerLevels.map((item, index) => (
                      <Cell
                        fill={COLORS[index % COLORS.length]}
                        key={item.name}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      border: "1px solid #dce6ed",
                      borderRadius: 12,
                      fontSize: 10,
                    }}
                    formatter={(value) => [String(value) + " 家", "客户数"]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                <div>
                  <div className="text-[28px] font-semibold tracking-[-0.05em] text-[#17354e]">
                    {customerTotal}
                  </div>
                  <div className="text-[9px] text-[#8595a3]">客户总数</div>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              {data.customerLevels.map((item, index) => (
                <div
                  className="flex items-center justify-between rounded-xl border border-[#e6edf1] bg-[#f9fbfc] px-3 py-2.5"
                  key={item.name}
                >
                  <span className="flex items-center gap-2 text-[10px] text-[#526878]">
                    <i
                      className="size-2.5 rounded-[3px]"
                      style={{ backgroundColor: COLORS[index] }}
                    />
                    {item.name}
                  </span>
                  <span className="text-xs font-semibold tabular-nums text-[#203b52]">
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className={card}>
          <ChartHeader
            badge={money(agingTotal)}
            subtitle="未核销应收余额，按当前日期与到期日计算"
            title="应收账龄结构"
          />
          <div className="h-[285px] px-3 pb-5 pt-4 sm:px-5">
            {agingTotal > 0 ? (
              <ResponsiveContainer height="100%" width="100%">
                <BarChart
                  data={data.receivableAging}
                  layout="vertical"
                  margin={{ left: 18, right: 28 }}
                >
                  <CartesianGrid
                    horizontal={false}
                    stroke="#e9eef2"
                    strokeDasharray="3 4"
                  />
                  <XAxis
                    axisLine={false}
                    fontSize={9}
                    tick={{ fill: "#8293a1" }}
                    tickFormatter={(value) =>
                      Math.round(Number(value) / 10000) + "万"
                    }
                    tickLine={false}
                    type="number"
                  />
                  <YAxis
                    axisLine={false}
                    dataKey="name"
                    fontSize={10}
                    tick={{ fill: "#536979" }}
                    tickLine={false}
                    type="category"
                    width={88}
                  />
                  <Tooltip
                    contentStyle={{
                      border: "1px solid #dce6ed",
                      borderRadius: 12,
                      fontSize: 10,
                    }}
                    formatter={(value) => [money(Number(value)), "应收余额"]}
                  />
                  <Bar dataKey="value" fill="#3d82b8" radius={[0, 7, 7, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState text="当前权限范围内暂无应收余额" />
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,.9fr)]">
        <section className={card}>
          <ChartHeader
            badge="SKU 数量"
            subtitle="深色为各品类启用 SKU，金色为其中风险 SKU"
            title="库存品类与风险"
          />
          <div className="h-[300px] px-3 pb-5 pt-4 sm:px-5">
            <ResponsiveContainer height="100%" width="100%">
              <BarChart data={data.inventoryCategories}>
                <CartesianGrid
                  stroke="#e9eef2"
                  strokeDasharray="3 4"
                  vertical={false}
                />
                <XAxis
                  axisLine={false}
                  dataKey="name"
                  fontSize={9}
                  tick={{ fill: "#607686" }}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  axisLine={false}
                  fontSize={9}
                  tick={{ fill: "#8b9aa7" }}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    border: "1px solid #dce6ed",
                    borderRadius: 12,
                    fontSize: 10,
                  }}
                />
                <Bar
                  dataKey="value"
                  fill="#0b7182"
                  name="启用 SKU"
                  radius={[7, 7, 0, 0]}
                />
                <Bar
                  dataKey="secondary"
                  fill="#d5a646"
                  name="风险 SKU"
                  radius={[7, 7, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className={card}>
          <ChartHeader
            badge="TOP 6"
            subtitle="按未核销应收余额排序，用于回款跟进"
            title="客户应收集中度"
          />
          <div className="space-y-4 px-5 pb-6 pt-5 sm:px-6">
            {data.receivableRanking.length > 0 ? (
              data.receivableRanking.map((item, index) => (
                <div key={item.name}>
                  <div className="flex items-center justify-between gap-3 text-[10px]">
                    <span className="min-w-0 truncate text-[#405a6e]">
                      <b className="mr-2 font-mono text-[#8a9aa7]">
                        {String(index + 1).padStart(2, "0")}
                      </b>
                      {item.name}
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums text-[#17364e]">
                      {money(item.outstanding)}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#edf2f5]">
                    <div
                      className="h-full rounded-full bg-[#0b7182]"
                      style={{
                        width:
                          String(
                            Math.max(
                              3,
                              (item.outstanding / maxRanking) * 100,
                            ),
                          ) + "%",
                      }}
                    />
                  </div>
                  <div className="mt-1 text-right text-[8px] text-[#91a0ac]">
                    {item.documentCount} 笔往来
                  </div>
                </div>
              ))
            ) : (
              <EmptyState text="暂无可排名的应收余额" />
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className={card}>
          <ChartHeader
            badge={
              data.departmentHeadcount.reduce(
                (sum, item) => sum + item.value,
                0,
              ) + " 人"
            }
            subtitle="当前在职员工，按组织归属统计"
            title="部门人数结构"
          />
          <div className="h-[290px] px-3 pb-5 pt-4 sm:px-5">
            {data.departmentHeadcount.length > 0 ? (
              <ResponsiveContainer height="100%" width="100%">
                <BarChart
                  data={data.departmentHeadcount}
                  layout="vertical"
                  margin={{ left: 18, right: 28 }}
                >
                  <CartesianGrid
                    horizontal={false}
                    stroke="#e9eef2"
                    strokeDasharray="3 4"
                  />
                  <XAxis
                    allowDecimals={false}
                    axisLine={false}
                    fontSize={9}
                    tick={{ fill: "#8293a1" }}
                    tickLine={false}
                    type="number"
                  />
                  <YAxis
                    axisLine={false}
                    dataKey="name"
                    fontSize={10}
                    tick={{ fill: "#536979" }}
                    tickLine={false}
                    type="category"
                    width={82}
                  />
                  <Tooltip
                    contentStyle={{
                      border: "1px solid #dce6ed",
                      borderRadius: 12,
                      fontSize: 10,
                    }}
                    formatter={(value) => [String(value) + " 人", "在职人数"]}
                  />
                  <Bar dataKey="value" fill="#0b7182" radius={[0, 7, 7, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState text="暂无组织人数数据" />
            )}
          </div>
        </section>

        <section className={card}>
          <ChartHeader
            badge="实时状态"
            subtitle="已确认、履约中与已完成订单用于判断业务进度"
            title="销售订单状态"
          />
          <div className="grid grid-cols-2 gap-3 px-5 pb-6 pt-5 sm:grid-cols-5 sm:px-6">
            {data.orderStatuses.map((item, index) => (
              <div
                className="rounded-[16px] border border-[#e4ecef] bg-[#f8fafb] p-4 text-center"
                key={item.name}
              >
                <span
                  className="mx-auto block size-2 rounded-full"
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                <div className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[#18364f]">
                  {item.value}
                </div>
                <div className="mt-1 text-[9px] text-[#768998]">
                  {item.name}
                </div>
                <div className="mt-2 truncate text-[8px] text-[#9aa7b1]">
                  {money(item.secondary ?? 0)}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className={card}>
        <ChartHeader
          badge="数据治理"
          subtitle="展示每个业务模块当前可用于 BI 的真实数据覆盖"
          title="分析数据覆盖度"
        />
        <div className="grid gap-3 px-5 pb-6 pt-5 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
          {data.coverage.map((item) => (
            <div
              className="rounded-[16px] border border-[#e3ebef] bg-[#f9fbfc] p-4"
              key={item.label}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium text-[#455f72]">
                  {item.label}
                </span>
                <span
                  className={
                    "size-2 rounded-full " +
                    (item.status === "ready"
                      ? "bg-[#22a58a]"
                      : item.status === "restricted"
                        ? "bg-[#d5a646]"
                        : "bg-[#aab6bf]")
                  }
                />
              </div>
              <div className="mt-3 text-xl font-semibold tabular-nums text-[#18364f]">
                {item.status === "restricted" ? "—" : item.records}
              </div>
              <div className="mt-1 text-[8px] leading-4 text-[#8b9aa6]">
                {item.note}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="grid h-full min-h-40 place-items-center text-center text-[10px] text-[#8999a6]">
      {text}
    </div>
  );
}
