"use client";

import { useCallback, useState } from "react";
import axios from "axios";
import {
  Activity,
  AlertCircle,
  CircleCheckBig,
  Clock3,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { BusinessSourceChart } from "@/components/dashboard/BusinessSourceChart";
import { InventoryWarning } from "@/components/dashboard/InventoryWarning";
import { KPIOverview } from "@/components/dashboard/KPIOverview";
import { ProductRanking } from "@/components/dashboard/ProductRanking";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { SalesTrendChart } from "@/components/dashboard/SalesTrendChart";
import { TodoList } from "@/components/dashboard/TodoList";
import { WelcomeBanner } from "@/components/dashboard/WelcomeBanner";
import { WorkspacePreferences, type WorkspacePreferencesValue } from "@/components/dashboard/WorkspacePreferences";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  DashboardApiResponse,
  DashboardData,
} from "@/types/dashboard";

type DashboardIdentity = {
  name: string;
};

async function requestDashboard() {
  const response = await axios.get<DashboardApiResponse>("/api/dashboard", {
    headers: { Accept: "application/json" },
    timeout: 12000,
  });
  if (!response.data.ok) {
    throw new Error(response.data.error);
  }
  return response.data.data;
}

function dashboardErrorMessage(requestError: unknown) {
  if (axios.isAxiosError<DashboardApiResponse>(requestError)) {
    return requestError.response?.data && !requestError.response.data.ok
      ? requestError.response.data.error
      : "经营数据读取失败，请检查网络后重试";
  }
  return requestError instanceof Error
    ? requestError.message
    : "经营数据读取失败，请稍后重试";
}

function DashboardLoading() {
  return (
    <div aria-label="经营数据加载中" className="space-y-5">
      <Skeleton className="h-[164px] rounded-[22px] bg-[#dbe8ef]" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton className="h-[166px] rounded-[20px]" key={index} />
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
        <Skeleton className="h-[420px] rounded-[20px]" />
        <Skeleton className="h-[420px] rounded-[20px]" />
      </div>
      <div className="grid gap-5 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton className="h-[330px] rounded-[20px]" key={index} />
        ))}
      </div>
    </div>
  );
}

export function DashboardClient({
  identity,
  initialData,
  preferences,
}: {
  identity: DashboardIdentity;
  initialData: DashboardData;
  preferences: WorkspacePreferencesValue;
}) {
  const [data, setData] = useState<DashboardData | null>(initialData);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await requestDashboard());
    } catch (requestError) {
      setError(dashboardErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <main className="relative mx-auto max-w-[1720px] p-4 sm:p-6 xl:p-7 2xl:p-9">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 opacity-35 [background-image:linear-gradient(rgba(15,75,112,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(15,75,112,.035)_1px,transparent_1px)] [background-size:32px_32px] [mask-image:linear-gradient(to_bottom,black,transparent_38%)]"
          />
          {error && (
            <div
              aria-live="assertive"
              className="fixed right-4 top-20 z-50 flex max-w-sm items-start gap-3 rounded-2xl border border-[#f0d6d8] bg-white p-4 shadow-[0_18px_50px_rgba(65,25,30,.13)]"
              role="alert"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#fff0f1] text-[#cf5963]">
                <AlertCircle className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium text-[#582c30]">
                  数据加载失败
                </div>
                <p className="mt-1 text-[10px] leading-5 text-[#8a6669]">
                  {error}
                </p>
              </div>
              <button
                aria-label="重新加载"
                className="grid size-8 place-items-center rounded-full text-[#8a6669] hover:bg-[#fff4f4]"
                onClick={() => void loadDashboard()}
                type="button"
              >
                <RefreshCw className="size-3.5" />
              </button>
            </div>
          )}

          {loading ? (
            <DashboardLoading />
          ) : data ? (
            <div className="space-y-6">
              <WelcomeBanner
                generatedAt={data.generatedAt}
                name={identity.name}
              />
              <WorkspacePreferences value={preferences} />
              {!preferences.hiddenWidgets.includes("health") && (
              <section className="grid overflow-hidden rounded-[18px] border border-white/90 bg-white/72 shadow-[0_14px_38px_-30px_rgba(9,57,91,.5)] backdrop-blur-xl sm:grid-cols-3">
                {[
                  {
                    icon: Activity,
                    label: "经营数据",
                    value: "已同步",
                    note: new Intl.DateTimeFormat("zh-CN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    }).format(new Date(data.generatedAt)),
                    tone: "bg-[#dcf5f3] text-[#087a80]",
                  },
                  {
                    icon: CircleCheckBig,
                    label: "业务闭环",
                    value: "运行正常",
                    note: "销售 · 采购 · 仓储 · 财务",
                    tone: "bg-[#e9f3ff] text-[#3f72b4]",
                  },
                  {
                    icon: ShieldCheck,
                    label: "权限与审计",
                    value: "安全启用",
                    note: "按角色展示经营范围",
                    tone: "bg-[#fff4df] text-[#b77924]",
                  },
                ].map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <div
                      className={`flex items-center gap-3 px-5 py-3.5 ${
                        index > 0
                          ? "border-t border-[#e5edf2] sm:border-l sm:border-t-0"
                          : ""
                      }`}
                      key={item.label}
                    >
                      <span
                        className={`grid size-9 shrink-0 place-items-center rounded-xl ${item.tone}`}
                      >
                        <Icon className="size-4" />
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-[10px] text-[#728596]">
                          {item.label}
                          {index === 0 && <Clock3 className="size-3" />}
                        </div>
                        <div className="mt-0.5 flex items-baseline gap-2">
                          <span className="text-[12px] font-semibold text-[#203b53]">
                            {item.value}
                          </span>
                          <span className="truncate text-[9px] text-[#91a0ad]">
                            {item.note}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </section>
              )}
              {!preferences.hiddenWidgets.includes("kpis") && <KPIOverview items={data.kpis} />}
              <div className="grid items-stretch gap-6 xl:grid-cols-[minmax(0,1.22fr)_minmax(410px,.78fr)]">
                {!preferences.hiddenWidgets.includes("sales_trend") && <SalesTrendChart data={data.salesTrend} />}
                {!preferences.hiddenWidgets.includes("business_source") && <BusinessSourceChart
                  data={data.businessSource}
                  summary={data.businessSummary}
                />}
              </div>
              <div className="grid items-stretch gap-6 xl:grid-cols-3">
                {!preferences.hiddenWidgets.includes("products") && <ProductRanking items={data.products} />}
                {!preferences.hiddenWidgets.includes("inventory") && <InventoryWarning items={data.inventory} />}
                {!preferences.hiddenWidgets.includes("todos") && <TodoList items={data.todos} />}
              </div>
              {!preferences.hiddenWidgets.includes("quick_actions") && <QuickActions />}
            </div>
          ) : (
            <div className="grid min-h-[65vh] place-items-center rounded-[20px] border border-dashed border-[#d8e4ec] bg-white text-center">
              <div>
                <AlertCircle className="mx-auto size-6 text-[#8495a4]" />
                <p className="mt-3 text-sm font-medium">暂无经营数据</p>
                <button
                  className="mt-4 rounded-full bg-[#0d6475] px-4 py-2 text-xs text-white"
                  onClick={() => void loadDashboard()}
                  type="button"
                >
                  重新加载
                </button>
              </div>
            </div>
          )}
    </main>
  );
}
