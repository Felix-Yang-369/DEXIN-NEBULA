import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import test from "node:test";
import {
  createNavigationGroupMemory,
  ensureNavigationGroupOpen,
  setNavigationGroupOpen,
} from "../src/components/navigation/navigation-group-state.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("德小馨默认使用轻量单头像并按需加载完整面板", () => {
  const trigger = read("src/features/ai/floating-ai-assistant-trigger.tsx");
  const panel = read("src/features/ai/floating-ai-assistant.tsx");
  const avatar = read("src/components/brand/dexiaoxin-avatar.tsx");
  const smallAsset = statSync(
    new URL("../public/brand/dexiaoxin-avatar-256.webp", import.meta.url),
  );
  const largeAsset = statSync(
    new URL("../public/brand/dexiaoxin-avatar-512.webp", import.meta.url),
  );

  assert.match(trigger, /dynamic\(/);
  assert.match(trigger, /onMouseEnter=\{preloadAssistant\}/);
  assert.match(trigger, /pathname\.startsWith\("\/ai"\)/);
  assert.match(panel, /event\.key === "Escape"/);
  assert.match(avatar, /dexiaoxin-avatar-256\.webp/);
  assert.ok(smallAsset.size <= 60 * 1024);
  assert.ok(largeAsset.size <= 120 * 1024);
});

test("客户级别使用统一 S A B C 业务色组件", () => {
  const badge = read("src/components/business/customer-level-badge.tsx");
  const styles = read("src/app/globals.css");
  const list = read("src/app/customers/page.tsx");
  const detail = read("src/app/customers/[id]/page.tsx");

  for (const level of ["s", "a", "b", "c"]) {
    assert.match(styles, new RegExp(`--customer-level-${level}-surface:`));
    assert.match(badge, new RegExp(`bg-customer-level-${level}-surface`));
  }
  assert.match(list, /<CustomerLevelBadge level=\{customer\.level\}/);
  assert.match(detail, /<CustomerLevelBadge/);
});

test("侧边栏压缩为 232 与 64 像素并关闭批量预取", () => {
  const shell = read("src/components/navigation/app-shell-client.tsx");
  const navigation = read("src/components/navigation/platform-navigation-list.tsx");

  assert.match(shell, /mode === "compact" \? "64px" : "232px"/);
  assert.match(shell, /w-16 overflow-visible/);
  assert.match(shell, /w-\[232px\]/);
  assert.match(navigation, /prefetch=\{false\}/);
  assert.match(navigation, /router\.prefetch\(href\)/);
  assert.doesNotMatch(navigation, /group\.english/);
});

test("侧边栏分组可以独立展开并在路由变化时保留已有分组", () => {
  let openGroups = ensureNavigationGroupOpen(new Set(), "业务管理");
  openGroups = setNavigationGroupOpen(openGroups, "供应链管理", true);

  assert.deepEqual([...openGroups], ["业务管理", "供应链管理"]);

  openGroups = setNavigationGroupOpen(openGroups, "业务管理", false);
  assert.deepEqual([...openGroups], ["供应链管理"]);

  const routeChanged = ensureNavigationGroupOpen(openGroups, "财务管理");
  assert.deepEqual([...routeChanged], ["供应链管理", "财务管理"]);
});

test("侧边栏组件重新挂载后保留当前导航过程中的展开分组", () => {
  const memory = createNavigationGroupMemory();
  const labels = ["业务管理", "供应链管理", "财务管理"];
  let firstMount = memory.restore(labels, "业务管理");

  firstMount = setNavigationGroupOpen(firstMount, "供应链管理", true);
  memory.remember(labels, firstMount);

  const nextMount = memory.restore(labels, "财务管理");
  assert.deepEqual([...nextMount], ["业务管理", "供应链管理", "财务管理"]);
});

test("启动接口与热点 RLS 采用受控函数和单动作策略", () => {
  const migration = read(
    "supabase/migrations/20260904151403_app_bootstrap_and_hot_path_performance.sql",
  );
  const employee = read("src/features/auth/current-employee.ts");
  const shell = read("src/features/approvals/workflow-shell.tsx");

  assert.match(migration, /private\.current_app_bootstrap_impl/);
  assert.match(migration, /if v_auth_user_id is null/);
  assert.match(migration, /grant execute on function public\.current_app_bootstrap\(\) to authenticated/);
  assert.match(migration, /employees_org_status_name_idx/);
  assert.match(migration, /customer_followups_org_created_idx/);
  assert.match(migration, /for select to authenticated/);
  assert.match(migration, /for update to authenticated/);
  assert.match(employee, /supabase\.rpc\("current_app_bootstrap"\)/);
  assert.match(shell, /getAppBootstrap/);
  assert.doesNotMatch(shell, /current_shell_context/);
});

test("热点列表受控分页且 Vercel 函数固定新加坡", () => {
  const customers = read("src/app/customers/page.tsx");
  const products = read("src/app/products/page.tsx");
  const inventory = read("src/app/inventory/page.tsx");
  const finance = read("src/app/finance/page.tsx");
  const vercel = JSON.parse(read("vercel.json"));

  assert.match(customers, /\.range\(rangeFrom, rangeTo\)/);
  assert.match(customers, /\[20, 50, 100\]/);
  assert.match(products, /\.limit\(50\)/);
  assert.match(inventory, /view === "movements"/);
  assert.match(inventory, /view === "batches"/);
  assert.doesNotMatch(finance, /\.limit\((?:500|1000)\)/);
  assert.deepEqual(vercel.regions, ["sin1"]);
});
