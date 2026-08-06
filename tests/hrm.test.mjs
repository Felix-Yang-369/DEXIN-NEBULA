import assert from "node:assert/strict";
import test from "node:test";
import {
  contractExpiresWithin,
  remainingLeave,
} from "../src/features/employees/hrm.ts";

test("合同到期提醒包含已过期和未来 60 天边界", () => {
  assert.equal(contractExpiresWithin("2026-07-01", "2026-07-29", 60), true);
  assert.equal(contractExpiresWithin("2026-09-27", "2026-07-29", 60), true);
  assert.equal(contractExpiresWithin("2026-09-28", "2026-07-29", 60), false);
  assert.equal(contractExpiresWithin(null, "2026-07-29", 60), false);
});

test("假期余额不会展示为负数", () => {
  assert.equal(remainingLeave(10, 3.5), 6.5);
  assert.equal(remainingLeave(5, 5), 0);
  assert.equal(remainingLeave(5, 6), 0);
});
