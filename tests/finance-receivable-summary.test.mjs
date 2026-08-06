import assert from "node:assert/strict";
import test from "node:test";
import {
  receivableCollectionRate,
  resolveReceivableReportRange,
  summarizeReceivableRows,
} from "../src/features/finance/receivable-summary.ts";

test("应收报表日期传反时自动纠正", () => {
  assert.deepEqual(
    resolveReceivableReportRange("2026-07-31", "2026-07-01"),
    {
      startDate: "2026-07-01",
      endDate: "2026-07-31",
    },
  );
});

test("应收汇总金额与收款率按统一口径计算", () => {
  const totals = summarizeReceivableRows([
    {
      customer_key: "1",
      customer_id: "1",
      customer_no: "DXC-001",
      customer_name: "客户一",
      salesperson_no: "DXE-001",
      salesperson_name: "业务员",
      opening_balance: 1000,
      period_receivable: 500,
      period_received: 600,
      ending_balance: 900,
      overdue_balance: 300,
      document_count: 2,
    },
    {
      customer_key: "2",
      customer_id: "2",
      customer_no: "DXC-002",
      customer_name: "客户二",
      salesperson_no: null,
      salesperson_name: null,
      opening_balance: 200,
      period_receivable: 300,
      period_received: 100,
      ending_balance: 400,
      overdue_balance: 0,
      document_count: 1,
    },
  ]);

  assert.equal(totals.openingBalance, 1200);
  assert.equal(totals.periodReceivable, 800);
  assert.equal(totals.periodReceived, 700);
  assert.equal(totals.endingBalance, 1300);
  assert.equal(totals.overdueBalance, 300);
  assert.equal(totals.documentCount, 3);
  assert.equal(totals.collectionRate, 0.35);
});

test("没有可收余额时收款率不显示误导性百分比", () => {
  assert.equal(receivableCollectionRate(0, 0, 100), null);
});
