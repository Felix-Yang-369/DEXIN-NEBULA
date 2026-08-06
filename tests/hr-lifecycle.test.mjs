import assert from "node:assert/strict";
import test from "node:test";
import {
  isLifecycleTaskOverdue,
  lifecycleProgress,
} from "../src/features/hr/lifecycle.ts";

test("入离职清单进度包含完成和不适用事项", () => {
  assert.deepEqual(
    lifecycleProgress([
      { status: "completed" },
      { status: "not_applicable" },
      { status: "pending" },
      { status: "pending" },
    ]),
    { completed: 2, total: 4, percent: 50 },
  );
  assert.deepEqual(lifecycleProgress([]), {
    completed: 0,
    total: 0,
    percent: 0,
  });
});

test("只有截止日期早于今天的待处理事项才算逾期", () => {
  assert.equal(isLifecycleTaskOverdue("2026-07-28", "pending", "2026-07-29"), true);
  assert.equal(isLifecycleTaskOverdue("2026-07-29", "pending", "2026-07-29"), false);
  assert.equal(isLifecycleTaskOverdue("2026-07-28", "completed", "2026-07-29"), false);
  assert.equal(isLifecycleTaskOverdue(null, "pending", "2026-07-29"), false);
});
