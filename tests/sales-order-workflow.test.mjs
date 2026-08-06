import assert from "node:assert/strict";
import test from "node:test";
import {
  availableSalesOrderTransitions,
  canTransitionSalesOrder,
} from "../src/features/sales/order-workflow.ts";

test("销售订单草稿可以确认或取消", () => {
  assert.deepEqual(availableSalesOrderTransitions("draft"), [
    "confirmed",
    "cancelled",
  ]);
  assert.equal(canTransitionSalesOrder("draft", "confirmed"), true);
});

test("已确认订单在履约功能上线前只允许取消", () => {
  assert.deepEqual(availableSalesOrderTransitions("confirmed"), ["cancelled"]);
  assert.equal(canTransitionSalesOrder("confirmed", "completed"), false);
});

test("已完成和已取消订单不允许再次流转", () => {
  assert.deepEqual(availableSalesOrderTransitions("completed"), []);
  assert.deepEqual(availableSalesOrderTransitions("cancelled"), []);
});
