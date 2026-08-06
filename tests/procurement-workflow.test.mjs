import assert from "node:assert/strict";
import test from "node:test";
import {
  canTransitionPurchaseOrder,
  canTransitionPurchaseRequest,
  purchaseOrderOutstanding,
} from "../src/features/procurement/workflow.ts";

test("采购申请提交后允许审批或撤回", () => {
  assert.equal(canTransitionPurchaseRequest("submitted", "approved"), true);
  assert.equal(canTransitionPurchaseRequest("submitted", "rejected"), true);
  assert.equal(canTransitionPurchaseRequest("submitted", "cancelled"), true);
  assert.equal(canTransitionPurchaseRequest("approved", "cancelled"), false);
});

test("采购订单仅在确认后进入到货履约", () => {
  assert.equal(canTransitionPurchaseOrder("draft", "confirmed"), true);
  assert.equal(canTransitionPurchaseOrder("draft", "received"), false);
  assert.equal(canTransitionPurchaseOrder("confirmed", "partial_received"), true);
  assert.equal(canTransitionPurchaseOrder("partial_received", "received"), true);
});

test("采购订单未收数量不会出现负数", () => {
  assert.equal(purchaseOrderOutstanding(100, 35), 65);
  assert.equal(purchaseOrderOutstanding(100, 100), 0);
  assert.equal(purchaseOrderOutstanding(100, 120), 0);
});
