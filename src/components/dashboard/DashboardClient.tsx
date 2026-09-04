"use client";

import { useCallback, useState } from "react";
import axios from "axios";
import dynamic from "next/dynamic";
import {
  Activity,
  AlertCircle,
  CircleCheckBig,
  Clock3,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { InventoryWarning } from "@/components/dashboard/InventoryWarning";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { TodoList } from "@/components/dashboard/TodoList";
import { WelcomeBanner } from "@/components/dashboard/WelcomeBanner";
import { WorkspacePreferences, type WorkspacePreferencesValue } from "@/components/dashboard/WorkspacePreferences";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  DashboardApiResponse,
  DashboardData,
} from "@/types/dashboard";

const KPIOverview = dynamic(() => import("@/components/dashboard/KPIOverview").then((module) => module.KPIOverview), { loading: () => <Skeleton className="h-[150px] rounded-md" /> });
const SalesTrendChart = dynamic(() => import("@/components/dashboard/SalesTrendChart").then((module) => module.SalesTrendChart), { loading: () => <Skeleton className="h-[390px] rounded-md" /> });
const BusinessSourceChart = dynamic(() => import("@/components/dashboard/BusinessSourceChart").then((module) => module.BusinessSourceChart), { loading: () => <Skeleton className="h-[390px] rounded-md" /> });
const ProductRanking = dynamic(() => import("@/components/dashboard/ProductRanking").then((module) => module.ProductRanking), { loading: () => <Skeleton className="h-[320px] rounded-md" /> });

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
      <Skeleton className="h-[164px] rounded-md bg-muted" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton className="h-[166px] rounded-md" key={index} />
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
        <Skeleton className="h-[420px] rounded-md" />
        <Skeleton className="h-[420px] rounded-md" />
      </div>
      <div className="grid gap-5 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton className="h-[330px] rounded-md" key={index} />
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
    <main className="ui-page-container-wide">
          {error && (
            <div
              aria-live="assertive"
              className="ui-overlay fixed right-4 top-20 z-50 flex max-w-sm items-start gap-3 p-4"
              role="alert"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-full ui-status-danger">
                <AlertCircle className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-foreground">
                  数据加载失败
                </div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {error}
                </p>
              </div>
              <button
                aria-label="重新加载"
                className="grid size-8 place-items-center rounded-md text-foreground hover:bg-muted"
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
              <div className="grid items-stretch gap-4 xl:grid-cols-2">
                {!preferences.hiddenWidgets.includes("todos") && <TodoList items={data.todos} />}
                {!preferences.hiddenWidgets.includes("inventory") && <InventoryWarning items={data.inventory} />}
              </div>
              {!preferences.hiddenWidgets.includes("kpis") && <KPIOverview items={data.kpis} />}
              <div className="ui-lazy-section grid items-stretch gap-5 xl:grid-cols-[minmax(0,1.22fr)_minmax(410px,.78fr)]">
                {!preferences.hiddenWidgets.includes("sales_trend") && <SalesTrendChart data={data.salesTrend} />}
                {!preferences.hiddenWidgets.includes("business_source") && <BusinessSourceChart data={data.businessSource} summary={data.businessSummary} />}
              </div>
              <div className="ui-lazy-section grid items-stretch gap-5 xl:grid-cols-[1fr_1fr]">
                {!preferences.hiddenWidgets.includes("products") && <ProductRanking items={data.products} />}
                {!preferences.hiddenWidgets.includes("quick_actions") && <QuickActions />}
              </div>
              {!preferences.hiddenWidgets.includes("health") && (
              <section className="grid overflow-hidden rounded-md border border-border bg-white sm:grid-cols-3">
                {[
                  {
                    icon: Activity,
                    label: "经营数据",
                    value: "已同步",
                    note: new Intl.DateTimeFormat("zh-CN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    }).format(new Date(data.generatedAt)),
                  },
                  {
                    icon: CircleCheckBig,
                    label: "业务闭环",
                    value: "运行正常",
                    note: "销售 · 采购 · 仓储 · 财务",
                  },
                  {
                    icon: ShieldCheck,
                    label: "权限与审计",
                    value: "安全启用",
                    note: "按角色展示经营范围",
                  },
                ].map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <div
                      className={`flex items-center gap-3 px-5 py-3.5 ${
                        index > 0
                          ? "border-t border-border sm:border-l sm:border-t-0"
                          : ""
                      }`}
                      key={item.label}
                    >
                      <Icon className="size-4 shrink-0 text-primary" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {item.label}
                          {index === 0 && <Clock3 className="size-3" />}
                        </div>
                        <div className="mt-0.5 flex items-baseline gap-2">
                          <span className="text-[12px] font-semibold text-foreground">
                            {item.value}
                          </span>
                          <span className="truncate text-xs text-muted-foreground">
                            {item.note}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </section>
              )}
            </div>
          ) : (
            <div className="grid min-h-[65vh] place-items-center rounded-md border border-dashed border-border bg-white text-center">
              <div>
                <AlertCircle className="mx-auto size-6 text-foreground" />
                <p className="mt-3 text-sm font-medium">暂无经营数据</p>
                <button
                  className="mt-4 rounded-md bg-primary px-4 py-2 text-sm text-white"
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
