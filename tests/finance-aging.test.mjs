import assert from "node:assert/strict";
import test from "node:test";
import {
  agingBucket,
  outstandingAmount,
} from "../src/features/finance/aging.ts";

test("账龄边界按到期日正确分桶", () => {
  const asOf = "2026-07-29";
  assert.equal(agingBucket("2026-07-29", asOf), "current");
  assert.equal(agingBucket("2026-07-30", asOf), "current");
  assert.equal(agingBucket("2026-07-28", asOf), "1-30");
  assert.equal(agingBucket("2026-06-29", asOf), "1-30");
  assert.equal(agingBucket("2026-06-28", asOf), "31-60");
  assert.equal(agingBucket("2026-05-30", asOf), "31-60");
  assert.equal(agingBucket("2026-05-29", asOf), "61-90");
  assert.equal(agingBucket("2026-04-30", asOf), "61-90");
  assert.equal(agingBucket("2026-04-29", asOf), "90+");
});

test("未核销余额不会小于零", () => {
  assert.equal(outstandingAmount(1000, 320), 680);
  assert.equal(outstandingAmount(1000, 1000), 0);
  assert.equal(outstandingAmount(1000, 1100), 0);
});
