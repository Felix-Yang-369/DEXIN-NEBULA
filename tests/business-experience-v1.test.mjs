import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("采购控制塔覆盖询比价、质检、退货与三单匹配", async () => {
  const sql = await read("supabase/migrations/20260826185726_procurement_quality_matching_v1.sql");
  assert.match(sql, /create table public\.procurement_rfqs/);
  assert.match(sql, /create table public\.goods_receipt_inspections/);
  assert.match(sql, /complete_purchase_return/);
  assert.match(sql, /perform_procurement_three_way_match/);
  assert.match(sql, /revoke all on table public\.%I from public,anon,authenticated/);
  assert.match(sql, /enable row level security/);
});

test("精细库存具备库位、FEFO、成本与受控库存价值", async () => {
  const sql = await read("supabase/migrations/20260826185731_inventory_lot_location_costing_v1.sql");
  assert.match(sql, /create table public\.warehouse_locations/);
  assert.match(sql, /issue_strategy.*'fefo'/s);
  assert.match(sql, /unit_cost numeric/);
  assert.match(sql, /inventory_valuation_summary/);
  assert.match(sql, /can_view_procurement_operations/);
});

test("CRM 公海与信用控制由数据库强制执行", async () => {
  const sql = await read("supabase/migrations/20260826185735_crm_customer_operations_v1.sql");
  assert.match(sql, /customer_credit_profiles/);
  assert.match(sql, /move_customer_to_public_pool/);
  assert.match(sql, /claim_customer_from_public_pool/);
  assert.match(sql, /sales_orders_enforce_customer_credit/);
  assert.match(sql, /订单超过客户可用信用额度/);
});

test("业财自动化防止同一业务单据重复制单", async () => {
  const sql = await read("supabase/migrations/20260826185740_business_accounting_automation_v1.sql");
  assert.match(sql, /unique\(organization_id,source_type,source_id\)/);
  assert.match(sql, /generate_business_journal_draft/);
  assert.match(sql, /create_journal_entry/);
  assert.match(sql, /finance_document/);
});

test("财务深化台账启用资产、预算、费用与税务的行级隔离", async () => {
  const sql = await read("supabase/migrations/20260829081824_finance_deepening_v1.sql");
  assert.match(sql, /create table public\.fixed_assets/);
  assert.match(sql, /create table public\.fixed_asset_depreciations/);
  assert.match(sql, /create table public\.budget_versions/);
  assert.match(sql, /create table public\.budget_lines/);
  assert.match(sql, /create table public\.expense_accounting_links/);
  assert.match(sql, /create table public\.tax_assist_records/);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /revoke all on public\.fixed_assets/);
});

test("用户体验包含可安装 PWA、配置表单与打印模板", async () => {
  const [manifest, worker, forms, print] = await Promise.all([
    read("src/app/manifest.ts"),
    read("public/sw.js"),
    read("supabase/migrations/20260826191906_configurable_forms_v1.sql"),
    read("supabase/migrations/20260826191911_print_template_center_v1.sql"),
  ]);
  assert.match(manifest, /display: "standalone"/);
  assert.match(worker, /request\.mode === "navigate"/);
  assert.match(forms, /field_schema jsonb/);
  assert.match(forms, /pg_column_size\(p_payload\)>65536/);
  assert.match(print, /show_watermark boolean/);
});
