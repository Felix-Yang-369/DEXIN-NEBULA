import assert from "node:assert/strict";
import test from "node:test";
import {
  cashDocumentActions,
  cashDocumentReversalActions,
  nextCashDocumentStatus,
} from "../src/features/finance/cash-document-workflow.ts";

test("收款单由财务提交并确认到账", () => {
  assert.deepEqual(
    cashDocumentActions({
      type: "receipt",
      status: "draft",
      roleCodes: ["employee", "finance"],
    }),
    ["submit", "void"],
  );
  assert.equal(nextCashDocumentStatus("receipt", "draft", "submit"), "submitted");
  assert.equal(
    nextCashDocumentStatus("receipt", "submitted", "complete"),
    "completed",
  );
});

test("付款单必须经过董事长审批后由财务执行", () => {
  assert.deepEqual(
    cashDocumentActions({
      type: "payment",
      status: "submitted",
      roleCodes: ["employee", "finance"],
    }),
    [],
  );
  assert.deepEqual(
    cashDocumentActions({
      type: "payment",
      status: "submitted",
      roleCodes: ["employee", "chairman"],
    }),
    ["approve", "reject", "void"],
  );
  assert.equal(
    nextCashDocumentStatus("payment", "submitted", "approve"),
    "approved",
  );
  assert.equal(
    nextCashDocumentStatus("payment", "approved", "complete"),
    "completed",
  );
});

test("完成和作废单据不能再次流转", () => {
  assert.deepEqual(
    cashDocumentActions({
      type: "receipt",
      status: "completed",
      roleCodes: ["finance"],
    }),
    [],
  );
  assert.equal(nextCashDocumentStatus("payment", "completed", "void"), null);
});

test("已完成单据由财务申请、董事长审批红冲", () => {
  assert.deepEqual(
    cashDocumentReversalActions({
      status: "completed",
      reversalStatus: null,
      roleCodes: ["finance"],
    }),
    ["request"],
  );
  assert.deepEqual(
    cashDocumentReversalActions({
      status: "completed",
      reversalStatus: "pending",
      roleCodes: ["chairman"],
    }),
    ["approve", "reject"],
  );
  assert.deepEqual(
    cashDocumentReversalActions({
      status: "completed",
      reversalStatus: "reversed",
      roleCodes: ["chairman", "finance"],
    }),
    [],
  );
});
