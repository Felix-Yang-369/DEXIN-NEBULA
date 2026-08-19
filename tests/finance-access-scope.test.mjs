import assert from "node:assert/strict";
import test from "node:test";
import {
  isFinanceScopeAllowedPath,
  isScopedFinanceUser,
} from "../src/lib/auth/access-scope.ts";

test("普通财务账号使用受限财务范围", () => {
  assert.equal(isScopedFinanceUser(["employee", "finance"]), true);
  assert.equal(isScopedFinanceUser(["employee"]), false);
});

test("兼任治理角色的财务账号不套用专岗限制", () => {
  assert.equal(
    isScopedFinanceUser(["employee", "finance", "chairman"]),
    false,
  );
  assert.equal(
    isScopedFinanceUser(["employee", "finance", "admin"]),
    false,
  );
});

test("财务专岗只允许财务与基础协同路径", () => {
  assert.equal(isFinanceScopeAllowedPath("/auth/signout"), true);
  assert.equal(isFinanceScopeAllowedPath("/finance/invoices"), true);
  assert.equal(isFinanceScopeAllowedPath("/reports/weekly"), true);
  assert.equal(isFinanceScopeAllowedPath("/account"), true);
  assert.equal(isFinanceScopeAllowedPath("/employees"), false);
  assert.equal(isFinanceScopeAllowedPath("/customers"), false);
  assert.equal(isFinanceScopeAllowedPath("/roles"), false);
});
