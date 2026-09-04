import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [permissionMigration, accountingMigration, operationsMigration, statementsMigration, permissionActions, accountingActions] = await Promise.all([
  readFile(new URL("../supabase/migrations/20260826134558_permission_center_v2.sql", import.meta.url), "utf8"),
  readFile(new URL("../supabase/migrations/20260826134610_accounting_kernel_v1.sql", import.meta.url), "utf8"),
  readFile(new URL("../supabase/migrations/20260826140729_accounting_operations_and_ledgers.sql", import.meta.url), "utf8"),
  readFile(new URL("../supabase/migrations/20260826143724_financial_statements_and_closing.sql", import.meta.url), "utf8"),
  readFile(new URL("../src/features/permissions/access-center-actions.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/features/finance/accounting-actions.ts", import.meta.url), "utf8"),
]);

test("权限中心使用稳定权限编码、显式禁止优先和数据库授权", () => {
  assert.match(permissionMigration, /finance\.voucher\.post/);
  assert.match(permissionMigration, /bool_or\(grant_row\.effect = 'deny'\)/);
  assert.match(permissionMigration, /create or replace function public\.effective_employee_permissions/);
  assert.match(permissionMigration, /create or replace function public\.has_access_permission/);
  assert.match(permissionMigration, /enable row level security/g);
  assert.match(permissionMigration, /revoke all on table public\.access_roles from public, anon, authenticated/);
  assert.match(permissionActions, /requireCurrentEmployee/);
  assert.match(permissionActions, /rpc\("configure_access_role"/);
});

test("会计凭证由数据库强制开放期间、借贷平衡和职责分离", () => {
  assert.match(accountingMigration, /period\.status = 'open'/);
  assert.match(accountingMigration, /v_line_count < 2 or v_debit <= 0 or v_debit <> v_credit/);
  assert.match(accountingMigration, /制单人不能审核本人凭证/);
  assert.match(accountingMigration, /has_access_permission\('finance\.voucher\.review'\)/);
  assert.match(accountingMigration, /has_access_permission\('finance\.voucher\.post'\)/);
  assert.match(accountingMigration, /已过账凭证不可直接修改或删除/);
  assert.match(accountingMigration, /unique \(book_id, entry_no\)/);
  assert.match(accountingActions, /rpc\("create_journal_entry"/);
  assert.match(accountingActions, /rpc\("transition_journal_entry"/);
});

test("新财务表仅开放只读 Data API，写入必须经过事务函数", () => {
  for (const table of ["accounting_books", "fiscal_periods", "accounting_accounts", "journal_entries", "journal_lines"]) {
    assert.match(accountingMigration, new RegExp(`revoke all on table public\\.${table} from public, anon, authenticated`));
    assert.match(accountingMigration, new RegExp(`grant select on table public\\.${table} to authenticated`));
  }
  assert.doesNotMatch(accountingMigration, /grant (insert|update|delete|all) on table public\.journal_/i);
});

test("第二批会计治理支持顺序结账、受控反结账和年度初始化", () => {
  assert.match(operationsMigration, /create or replace function public\.transition_fiscal_period/);
  assert.match(operationsMigration, /必须先关闭更早的会计期间/);
  assert.match(operationsMigration, /只有董事长可以重新开放已结账期间/);
  assert.match(operationsMigration, /期间仍有未过账凭证/);
  assert.match(operationsMigration, /create or replace function public\.create_fiscal_year/);
});

test("冲销生成反向凭证并保留原始凭证关联", () => {
  assert.match(operationsMigration, /create or replace function public\.reverse_journal_entry/);
  assert.match(operationsMigration, /line\.credit_amount, line\.debit_amount/);
  assert.match(operationsMigration, /status = 'reversed', reversal_entry_id = v_reversal_id/);
  assert.match(operationsMigration, /old\.status = 'posted' and new\.status = 'reversed'/);
  assert.doesNotMatch(operationsMigration, /delete from public\.journal_(entries|lines)/);
});

test("正式账簿只汇总已过账与已冲销凭证", () => {
  assert.match(operationsMigration, /create or replace function public\.account_trial_balance/);
  assert.match(operationsMigration, /create or replace function public\.account_detail_ledger/);
  assert.match(operationsMigration, /entry\.status in \('posted', 'reversed'\)/g);
  assert.match(operationsMigration, /has_access_permission\('finance\.ledger\.view'\)/);
});

test("第三批期初余额只能在年度首次记账前生成平衡草稿", () => {
  assert.match(statementsMigration, /create or replace function public\.create_opening_balance_entry/);
  assert.match(statementsMigration, /该年度已有会计凭证，不能重新导入期初余额/);
  assert.match(statementsMigration, /v_count < 2 or v_debit <= 0 or v_debit <> v_credit/);
  assert.match(statementsMigration, /'opening_balance'.*'draft'/s);
  assert.match(statementsMigration, /is_opening\s*\) values/s);
  assert.match(statementsMigration, /期初余额不能通过普通凭证冲销/);
  assert.match(accountingActions, /rpc\("create_opening_balance_entry"/);
});

test("期间结账要求损益结转草稿完成独立审核与过账", () => {
  assert.match(statementsMigration, /create or replace function public\.generate_period_closing_entry/);
  assert.match(statementsMigration, /entry\.source_type <> 'period_close'/g);
  assert.match(statementsMigration, /'period_close'.*'draft'/s);
  assert.match(statementsMigration, /create or replace function public\.enforce_period_close_readiness/);
  assert.match(statementsMigration, /coalesce\(v_closing_status, ''\) <> 'posted'/);
  assert.match(statementsMigration, /含已过账损益结转的期间暂不支持直接反结账/);
  assert.match(accountingActions, /rpc\("generate_period_closing_entry"/);
});

test("三大报表仅汇总已过账数据并显式保留待分类现金流", () => {
  assert.match(statementsMigration, /create or replace function public\.balance_sheet_report/);
  assert.match(statementsMigration, /create or replace function public\.income_statement_report/);
  assert.match(statementsMigration, /create or replace function public\.cash_flow_statement_report/);
  assert.match(statementsMigration, /entry\.status in \('posted', 'reversed'\)/g);
  assert.match(statementsMigration, /'unclassified', '待分类现金流量'/);
  assert.match(statementsMigration, /finance\.statement\.view/);
  assert.match(statementsMigration, /configure_account_cash_flow_rule/);
  assert.doesNotMatch(statementsMigration, /grant (insert|update|delete|all) on table public\.account_cash_flow_rules/i);
});
