import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSealApprovalRoute,
  requiresChairmanApproval,
} from "../src/features/approvals/seal-workflow.ts";

test("普通其他用印经过直属负责人和行政登记", () => {
  assert.deepEqual(
    buildSealApprovalRoute("other", false).map((step) => step.code),
    ["department_review", "seal_custodian"],
  );
});

test("公章、合同章、财务章和法人章增加董事长审批", () => {
  for (const sealType of [
    "company",
    "contract",
    "finance",
    "legal_representative",
  ]) {
    assert.equal(requiresChairmanApproval(sealType, false), true);
    assert.deepEqual(
      buildSealApprovalRoute(sealType, false).map((step) => step.code),
      ["department_review", "chairman_approval", "seal_custodian"],
    );
  }
});

test("印章外带无论类型均增加董事长审批", () => {
  assert.deepEqual(
    buildSealApprovalRoute("other", true).map((step) => step.code),
    ["department_review", "chairman_approval", "seal_custodian"],
  );
});
