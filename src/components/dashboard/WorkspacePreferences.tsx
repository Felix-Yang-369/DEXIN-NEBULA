"use client";

import Link from "next/link";
import { Settings2, SlidersHorizontal } from "lucide-react";
import { saveWorkspacePreferencesAction } from "@/features/workspace/actions";

export type WorkspacePreferencesValue = {
  pinnedModules: string[];
  hiddenWidgets: string[];
  density: "comfortable" | "compact";
  defaultWorkspace: string;
};

const modules = [
  { key: "sales", label: "销售", href: "/sales" },
  { key: "inventory", label: "库存", href: "/inventory" },
  { key: "approvals", label: "审批", href: "/approvals" },
  { key: "customers", label: "客户", href: "/customers" },
  { key: "products", label: "商品", href: "/products" },
  { key: "finance", label: "财务", href: "/finance" },
  { key: "oa", label: "协同", href: "/oa" },
  { key: "system", label: "系统", href: "/system" },
];

const widgets = [
  { key: "health", label: "运行状态" },
  { key: "kpis", label: "经营指标" },
  { key: "sales_trend", label: "销售趋势" },
  { key: "business_source", label: "业务来源" },
  { key: "products", label: "商品排行" },
  { key: "inventory", label: "库存预警" },
  { key: "todos", label: "个人待办" },
  { key: "quick_actions", label: "快捷操作" },
];

export function WorkspacePreferences({
  value,
}: {
  value: WorkspacePreferencesValue;
}) {
  const pinned = modules.filter((module) =>
    value.pinnedModules.includes(module.key),
  );

  return (
    <section className="rounded-md border border-border bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-md bg-primary/5 text-primary">
            <SlidersHorizontal className="size-4" />
          </span>
          <div>
            <div className="text-xs font-semibold">我的工作台</div>
            <div className="text-xs text-muted-foreground">
              固定常用入口并选择首页组件
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {pinned.map((module) => (
            <Link
              className="rounded-md bg-muted px-3 py-1.5 text-xs text-foreground hover:bg-primary/5 hover:text-primary"
              href={module.href}
              key={module.key}
            >
              {module.label}
            </Link>
          ))}
        </div>
      </div>
      <details className="mt-3 border-t border-border pt-3">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-xs text-muted-foreground">
          <Settings2 className="size-3" />配置工作台
        </summary>
        <form
          action={saveWorkspacePreferencesAction}
          className="mt-4 grid gap-4 lg:grid-cols-3"
        >
          <input name="density" type="hidden" value="compact" />
          <fieldset>
            <legend className="text-xs font-medium">固定入口</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {modules.map((item) => (
                <label
                  className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1.5 text-xs"
                  key={item.key}
                >
                  <input
                    defaultChecked={value.pinnedModules.includes(item.key)}
                    name="pinned"
                    type="checkbox"
                    value={item.key}
                  />
                  {item.label}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="text-xs font-medium">隐藏组件</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {widgets.map((item) => (
                <label
                  className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1.5 text-xs"
                  key={item.key}
                >
                  <input
                    defaultChecked={value.hiddenWidgets.includes(item.key)}
                    name="hidden"
                    type="checkbox"
                    value={item.key}
                  />
                  {item.label}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="space-y-3">
            <label className="block text-xs">
              默认工作区
              <select
                className="mt-1 h-9 w-full rounded-md border border-border bg-white px-2"
                defaultValue={value.defaultWorkspace}
                name="defaultWorkspace"
              >
                <option value="dashboard">经营首页</option>
                <option value="sales">销售</option>
                <option value="inventory">库存</option>
                <option value="finance">财务</option>
                <option value="oa">协同</option>
              </select>
            </label>
            <p className="text-xs leading-5 text-muted-foreground">
              桌面端统一采用紧凑布局；移动端使用独立任务界面。
            </p>
            <button className="h-9 rounded-md bg-primary px-4 text-xs text-white">
              保存偏好
            </button>
          </div>
        </form>
      </details>
    </section>
  );
}
