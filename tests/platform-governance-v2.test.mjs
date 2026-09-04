import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("主数据质量中心使用扫描快照、权限和 RLS", async () => {
  const migration = await read("supabase/migrations/20260826183427_master_data_quality_and_workspace.sql");
  assert.match(migration, /create table public\.master_data_quality_issues/);
  assert.match(migration, /last_scan_id uuid not null/);
  assert.match(migration, /refresh_master_data_quality_issues/);
  assert.match(migration, /status = 'resolved'.*last_scan_id <> v_scan/s);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /has_access_permission\('system\.data_quality\.view'\)/);
  assert.match(migration, /revoke all on table public\.master_data_quality_issues/);
});

test("个人工作台偏好仅允许本人读取并通过受控 RPC 保存", async () => {
  const migration = await read("supabase/migrations/20260826183427_master_data_quality_and_workspace.sql");
  const dashboard = await read("src/app/dashboard/page.tsx");
  const client = await read("src/components/dashboard/DashboardClient.tsx");
  assert.match(migration, /workspace_preferences_select_own/);
  assert.match(migration, /employee_id = public\.current_employee_id\(\)/);
  assert.match(migration, /save_workspace_preferences/);
  assert.match(dashboard, /initialData=\{initialData\}/);
  assert.doesNotMatch(client, /useEffect/);
  assert.match(client, /WorkspacePreferences/);
});

test("性能治理限制采样并隐藏慢查询原文", async () => {
  const migration = await read("supabase/migrations/20260826183432_performance_observability_and_indexes.sql");
  assert.match(migration, /application_performance_events/);
  assert.match(migration, />= 300/);
  assert.match(migration, /pg_column_size.*> 4096/s);
  assert.match(migration, /md5\(query\)::text/);
  assert.doesNotMatch(migration, /returns table \([\s\S]*?query text/);
  assert.match(migration, /approval_requests_org_approver_pending_idx/);
  assert.match(migration, /notifications_org_recipient_unread_idx/);
});

test("治理页面复用统一业务表格", async () => {
  const table = await read("src/components/business/business-data-table.tsx");
  const quality = await read("src/app/system/data-quality/page.tsx");
  const performance = await read("src/app/system/observability/page.tsx");
  assert.match(table, /export function BusinessDataTable/);
  assert.match(table, /density.*comfortable.*compact/s);
  assert.match(quality, /BusinessDataTable/);
  assert.match(performance, /BusinessDataTable/);
});
