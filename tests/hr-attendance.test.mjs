import assert from "node:assert/strict";
import test from "node:test";
import {
  dateRangeOverlapDays,
  isOnApprovedLeave,
  leaveBalanceSyncLabel,
} from "../src/features/hr/attendance.ts";

test("请假跨月时只统计落在当前月份的天数", () => {
  assert.equal(
    dateRangeOverlapDays(
      "2026-07-30",
      "2026-08-03",
      "2026-07-01",
      "2026-07-31",
    ),
    2,
  );
  assert.equal(
    dateRangeOverlapDays(
      "2026-06-01",
      "2026-06-03",
      "2026-07-01",
      "2026-07-31",
    ),
    0,
  );
});

test("仅已通过且覆盖当天的申请计入今日休假", () => {
  assert.equal(
    isOnApprovedLeave("approved", "2026-07-28", "2026-07-30", "2026-07-29"),
    true,
  );
  assert.equal(
    isOnApprovedLeave(
      "pending_hr_filing",
      "2026-07-28",
      "2026-07-30",
      "2026-07-29",
    ),
    false,
  );
});

test("假期余额同步状态使用明确业务语言", () => {
  assert.equal(leaveBalanceSyncLabel("recorded"), "已同步余额");
  assert.equal(leaveBalanceSyncLabel("balance_missing"), "假期账户未配置");
});
