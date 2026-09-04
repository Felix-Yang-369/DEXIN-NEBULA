import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("next-stage migration secures shell preferences and saved views", async () => {
  const migration = await read(
    "supabase/migrations/20260904115539_next_stage_shell_and_finance_close.sql",
  );

  assert.match(migration, /sidebar_mode text not null default 'expanded'/);
  assert.match(migration, /check \(sidebar_mode in \('expanded', 'compact'\)\)/);
  assert.match(migration, /create or replace function public\.current_shell_context/);
  assert.match(migration, /alter table public\.business_saved_views enable row level security/);
  assert.match(migration, /revoke all on function public\.save_business_view/);
  assert.match(migration, /grant execute on function public\.save_business_view/);
});

test("month-end close supports blockers, warnings and repeatable controlled reopening", async () => {
  const migration = await read(
    "supabase/migrations/20260904115539_next_stage_shell_and_finance_close.sql",
  );

  assert.match(migration, /create or replace function public\.accounting_close_checklist/);
  assert.match(migration, /'blocker'/);
  assert.match(migration, /'warning'/);
  assert.match(migration, /status = 'reopening'/);
  assert.match(migration, /制单人不能审核或过账本人凭证/);
  assert.match(migration, /reversal_entry_id = new\.id/);
  assert.match(migration, /to_jsonb\(new\) - array/);
  assert.match(migration, /period_close_history_' \|\| lpad/);
  assert.match(migration, /acknowledgement\.warning_codes =/);
  assert.match(migration, /'period_reopened'/);
});

test("business table V2 exposes governed list capabilities", async () => {
  const table = await read("src/components/business/business-data-table.tsx");
  const viewsRoute = await read("src/app/api/workspace/views/[viewKey]/route.ts");

  assert.match(table, /sortKey/);
  assert.match(table, /sticky/);
  assert.match(table, /bulkActions/);
  assert.match(table, /md:hidden/);
  assert.match(table, /viewKey/);
  assert.match(viewsRoute, /save_business_view/);
});

test("dashboard business charts use real orders without demo fallback", async () => {
  const dashboard = await read("src/lib/api/dashboard.ts");

  assert.match(dashboard, /from\("sales_orders"\)/);
  assert.match(dashboard, /from\("sales_order_items"\)/);
  assert.doesNotMatch(dashboard, /DEMO_(SALES|PRODUCT|SOURCE)/);
});

test("financial statements provide comparisons and ledger drilldown", async () => {
  const statements = await read("src/app/finance/accounting/statements/page.tsx");
  const ledger = await read("src/app/finance/accounting/ledger/page.tsx");

  assert.match(statements, /previous/);
  assert.match(statements, /lastYear/);
  assert.match(statements, /accountCode/);
  assert.match(ledger, /accountCode/);
});
