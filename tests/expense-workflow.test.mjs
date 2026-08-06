import assert from "node:assert/strict";
import test from "node:test";
import {
  buildExpenseApprovalRoute,
  EXPENSE_CHAIRMAN_THRESHOLD,
} from "../src/features/approvals/expense-workflow.ts";

test("普通报销经过直属负责人和财务复核", () => {
  assert.deepEqual(
    buildExpenseApprovalRoute(300).map((step) => step.code),
    ["department_review", "finance_review"],
  );
});

test("等于试行阈值时不追加董事长审批", () => {
  assert.deepEqual(
    buildExpenseApprovalRoute(EXPENSE_CHAIRMAN_THRESHOLD).map(
      (step) => step.code,
    ),
    ["department_review", "finance_review"],
  );
});

test("超过试行阈值时追加董事长审批", () => {
  assert.deepEqual(
    buildExpenseApprovalRoute(EXPENSE_CHAIRMAN_THRESHOLD + 0.01).map(
      (step) => step.code,
    ),
    ["department_review", "finance_review", "chairman_approval"],
  );
});

test("拒绝无效报销金额", () => {
  assert.throws(() => buildExpenseApprovalRoute(0), /必须是大于 0/);
  assert.throws(() => buildExpenseApprovalRoute(Number.NaN), /必须是大于 0/);
});
