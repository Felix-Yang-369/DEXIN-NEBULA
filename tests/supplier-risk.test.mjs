import assert from "node:assert/strict";
import test from "node:test";
import {
  qualificationRisk,
  supplierRiskSummary,
} from "../src/features/suppliers/risk.ts";

test("供应商资质按到期日形成风险等级", () => {
  assert.equal(qualificationRisk("2026-07-29", "2026-07-30"), "expired");
  assert.equal(qualificationRisk("2026-09-28", "2026-07-30"), "expiring");
  assert.equal(qualificationRisk("2026-09-29", "2026-07-30"), "valid");
  assert.equal(qualificationRisk(null, "2026-07-30"), "no_expiry");
});

test("供应商风险优先展示已过期，其次临期和缺失", () => {
  assert.equal(
    supplierRiskSummary(
      [
        { expires_on: "2027-01-01", status: "active" },
        { expires_on: "2026-07-29", status: "active" },
      ],
      "2026-07-30",
    ),
    "expired",
  );
  assert.equal(supplierRiskSummary([], "2026-07-30"), "missing");
});
