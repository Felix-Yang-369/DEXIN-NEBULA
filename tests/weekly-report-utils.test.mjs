import assert from "node:assert/strict";
import test from "node:test";
import {
  addDays,
  formatWeekRange,
  isValidReportingWeek,
  mondayForDate,
} from "../src/features/reports/weekly-report-utils.ts";

test("上海时区周一凌晨对应到正确周报周期", () => {
  const sundayUtc = new Date("2026-07-26T16:30:00.000Z");
  assert.equal(mondayForDate(sundayUtc), "2026-07-27");
});

test("周报周期只接受周一且能计算周日", () => {
  assert.equal(isValidReportingWeek("2026-07-27"), true);
  assert.equal(isValidReportingWeek("2026-07-28"), false);
  assert.equal(addDays("2026-07-27", 6), "2026-08-02");
});

test("周报周期范围使用月日格式展示", () => {
  assert.equal(formatWeekRange("2026-07-27"), "07/27 — 08/02");
});
