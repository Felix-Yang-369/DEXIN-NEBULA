import assert from "node:assert/strict";
import test from "node:test";
import {
  availableSalesOrderTransitions,
  canTransitionSalesOrder,
} from "../src/features/sales/order-workflow.ts";

test("销售订单草稿可以提交确认审批或取消", () => {
  assert.deepEqual(availableSalesOrderTransitions("draft"), [
    "confirmed",
    "cancelled",
  ]);
  assert.equal(canTransitionSalesOrder("draft", "confirmed"), true);
});

test("审批中的销售订单不能绕过流程直接流转", () => {
  assert.deepEqual(availableSalesOrderTransitions("pending_approval"), []);
});

test("已确认订单允许取消，履约通过受控数据库动作执行", () => {
  assert.deepEqual(availableSalesOrderTransitions("confirmed"), ["cancelled"]);
  assert.equal(canTransitionSalesOrder("confirmed", "completed"), false);
});

test("已完成和已取消订单不允许再次流转", () => {
  assert.deepEqual(availableSalesOrderTransitions("completed"), []);
  assert.deepEqual(availableSalesOrderTransitions("cancelled"), []);
});
