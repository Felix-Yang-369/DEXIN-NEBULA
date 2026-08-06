"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import { createClient } from "@/lib/supabase/server";

function procurementRedirect(params: Record<string, string>, anchor = "overview"): never {
  redirect(`/purchasing?${new URLSearchParams(params).toString()}#${anchor}`);
}

function bankRedirect(params: Record<string, string>, anchor = "bank-lines"): never {
  redirect(`/finance/bank-reconciliation?${new URLSearchParams(params).toString()}#${anchor}`);
}

function jsonValue(value: FormDataEntryValue | null) {
  try {
    return JSON.parse(String(value ?? "[]")) as unknown;
  } catch {
    return null;
  }
}

const requestItemSchema = z.object({
  productId: z.uuid(),
  quantity: z.coerce.number().positive().max(999999),
});

const requestSchema = z.object({
  title: z.string().trim().min(2).max(120),
  reason: z.string().trim().max(1000),
  requiredOn: z.union([z.iso.date(), z.literal("")]),
  items: z.array(requestItemSchema).min(1).max(100),
});

export async function createPurchaseRequestAction(formData: FormData) {
  await requireCurrentEmployee();
  const parsed = requestSchema.safeParse({
    title: formData.get("title"),
    reason: formData.get("reason") ?? "",
    requiredOn: formData.get("requiredOn") ?? "",
    items: jsonValue(formData.get("items")),
  });
  if (!parsed.success) {
    procurementRedirect({ error: "采购申请资料不完整，请检查标题、日期和商品数量" }, "requests");
  }
  if (new Set(parsed.data.items.map((item) => item.productId)).size !== parsed.data.items.length) {
    procurementRedirect({ error: "同一商品不能重复添加" }, "requests");
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_purchase_request", {
    p_title: parsed.data.title,
    p_reason: parsed.data.reason || null,
    p_required_on: parsed.data.requiredOn || null,
    p_items: parsed.data.items,
  });
  if (error || !data) {
    console.error("createPurchaseRequestAction failed", error?.code);
    procurementRedirect({ error: "采购申请提交失败，请确认数据库迁移和产品资料" }, "requests");
  }
  const result = data as { requestNo?: string };
  revalidatePath("/purchasing");
  procurementRedirect({ created: result.requestNo ? `采购申请 ${result.requestNo} 已提交` : "采购申请已提交" }, "requests");
}

const requestTransitionSchema = z.object({
  requestId: z.uuid(),
  targetStatus: z.enum(["approved", "rejected", "cancelled"]),
  note: z.string().trim().max(500),
});

export async function transitionPurchaseRequestAction(formData: FormData) {
  await requireCurrentEmployee();
  const parsed = requestTransitionSchema.safeParse({
    requestId: formData.get("requestId"),
    targetStatus: formData.get("targetStatus"),
    note: formData.get("note") ?? "",
  });
  if (!parsed.success || (parsed.data.targetStatus === "rejected" && parsed.data.note.length < 2)) {
    procurementRedirect({ error: "采购申请操作无效；驳回时必须填写原因" }, "requests");
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("transition_purchase_request", {
    p_request_id: parsed.data.requestId,
    p_target_status: parsed.data.targetStatus,
    p_note: parsed.data.note || null,
  });
  if (error) {
    console.error("transitionPurchaseRequestAction failed", error.code);
    procurementRedirect({ error: "采购申请状态更新失败，请检查权限或当前状态" }, "requests");
  }
  revalidatePath("/purchasing");
  procurementRedirect({ created: "采购申请状态已更新" }, "requests");
}

const orderItemSchema = z.object({
  productId: z.uuid(),
  quantity: z.coerce.number().positive().max(999999),
  unitPrice: z.coerce.number().positive().max(10000000),
});

const orderSchema = z.object({
  supplierId: z.uuid(),
  warehouseId: z.uuid(),
  purchaseRequestId: z.union([z.uuid(), z.literal("")]),
  orderDate: z.iso.date(),
  expectedArrivalOn: z.union([z.iso.date(), z.literal("")]),
  paymentTerms: z.string().trim().max(500),
  deliveryTerms: z.string().trim().max(500),
  note: z.string().trim().max(1000),
  items: z.array(orderItemSchema).min(1).max(100),
});

export async function createPurchaseOrderAction(formData: FormData) {
  await requireCurrentEmployee();
  const parsed = orderSchema.safeParse({
    supplierId: formData.get("supplierId"),
    warehouseId: formData.get("warehouseId"),
    purchaseRequestId: formData.get("purchaseRequestId") ?? "",
    orderDate: formData.get("orderDate"),
    expectedArrivalOn: formData.get("expectedArrivalOn") ?? "",
    paymentTerms: formData.get("paymentTerms") ?? "",
    deliveryTerms: formData.get("deliveryTerms") ?? "",
    note: formData.get("note") ?? "",
    items: jsonValue(formData.get("items")),
  });
  if (!parsed.success) {
    procurementRedirect({ error: "采购订单资料不完整，请检查供应商、仓库、日期、数量和单价" }, "orders");
  }
  if (parsed.data.expectedArrivalOn && parsed.data.expectedArrivalOn < parsed.data.orderDate) {
    procurementRedirect({ error: "预计到货日期不能早于订单日期" }, "orders");
  }
  if (new Set(parsed.data.items.map((item) => item.productId)).size !== parsed.data.items.length) {
    procurementRedirect({ error: "同一商品不能重复添加" }, "orders");
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_purchase_order", {
    p_supplier_id: parsed.data.supplierId,
    p_warehouse_id: parsed.data.warehouseId,
    p_purchase_request_id: parsed.data.purchaseRequestId || null,
    p_order_date: parsed.data.orderDate,
    p_expected_arrival_on: parsed.data.expectedArrivalOn || null,
    p_payment_terms: parsed.data.paymentTerms || null,
    p_delivery_terms: parsed.data.deliveryTerms || null,
    p_note: parsed.data.note || null,
    p_items: parsed.data.items,
  });
  if (error || !data) {
    console.error("createPurchaseOrderAction failed", error?.code);
    procurementRedirect({ error: "采购订单创建失败，请确认供应商状态、采购申请和数据库迁移" }, "orders");
  }
  const result = data as { orderNo?: string };
  revalidatePath("/purchasing");
  procurementRedirect({ created: result.orderNo ? `采购订单 ${result.orderNo} 已保存` : "采购订单已保存" }, "orders");
}

const orderTransitionSchema = z.object({
  orderId: z.uuid(),
  targetStatus: z.enum(["confirmed", "cancelled"]),
  note: z.string().trim().max(500),
});

export async function transitionPurchaseOrderAction(formData: FormData) {
  await requireCurrentEmployee();
  const parsed = orderTransitionSchema.safeParse({
    orderId: formData.get("orderId"),
    targetStatus: formData.get("targetStatus"),
    note: formData.get("note") ?? "",
  });
  if (!parsed.success || (parsed.data.targetStatus === "cancelled" && parsed.data.note.length < 2)) {
    procurementRedirect({ error: "采购订单操作无效；取消时必须填写原因" }, "orders");
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("transition_purchase_order", {
    p_order_id: parsed.data.orderId,
    p_target_status: parsed.data.targetStatus,
    p_note: parsed.data.note || null,
  });
  if (error) {
    console.error("transitionPurchaseOrderAction failed", error.code);
    procurementRedirect({ error: "采购订单状态更新失败，请检查权限或当前状态" }, "orders");
  }
  revalidatePath("/purchasing");
  procurementRedirect({ created: "采购订单状态已更新" }, "orders");
}

const receiptItemSchema = z.object({
  purchaseOrderItemId: z.uuid(),
  quantity: z.coerce.number().positive().max(999999),
  productionDate: z.union([z.iso.date(), z.literal("")]),
  shelfLifeMonths: z.union([z.coerce.number().int().positive().max(120), z.literal("")]),
});

const receiptSchema = z.object({
  orderId: z.uuid(),
  receivedOn: z.iso.date(),
  supplierDeliveryNo: z.string().trim().max(100),
  note: z.string().trim().max(500),
  items: z.array(receiptItemSchema).min(1).max(100),
});

export async function receivePurchaseOrderAction(formData: FormData) {
  await requireCurrentEmployee();
  const parsed = receiptSchema.safeParse({
    orderId: formData.get("orderId"),
    receivedOn: formData.get("receivedOn"),
    supplierDeliveryNo: formData.get("supplierDeliveryNo") ?? "",
    note: formData.get("note") ?? "",
    items: jsonValue(formData.get("items")),
  });
  if (!parsed.success) {
    procurementRedirect({ error: "到货入库资料不完整，请检查日期、商品数量和效期" }, "receiving");
  }
  const items = parsed.data.items.filter((item) => Number(item.quantity) > 0);
  if (!items.length || new Set(items.map((item) => item.purchaseOrderItemId)).size !== items.length) {
    procurementRedirect({ error: "请选择至少一项到货商品，且商品不能重复" }, "receiving");
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("receive_purchase_order", {
    p_order_id: parsed.data.orderId,
    p_received_on: parsed.data.receivedOn,
    p_supplier_delivery_no: parsed.data.supplierDeliveryNo || null,
    p_note: parsed.data.note || null,
    p_items: items,
  });
  if (error || !data) {
    console.error("receivePurchaseOrderAction failed", error?.code);
    procurementRedirect({ error: "到货入库失败，请检查未收数量、仓储权限和数据库迁移" }, "receiving");
  }
  const result = data as { receiptNo?: string; payableDocumentNo?: string };
  revalidatePath("/purchasing");
  revalidatePath("/inventory");
  revalidatePath("/finance");
  procurementRedirect({ created: `${result.receiptNo ?? "入库单"} 已过账，并生成应付 ${result.payableDocumentNo ?? ""}`.trim() }, "receiving");
}

const bankLineSchema = z.object({
  bankAccountName: z.string().trim().min(2).max(120),
  transactionDate: z.iso.date(),
  direction: z.enum(["inflow", "outflow"]),
  counterpartyName: z.string().trim().max(120),
  summary: z.string().trim().max(300),
  bankReference: z.string().trim().max(120),
  amount: z.coerce.number().positive().max(100000000),
});

export async function registerBankStatementLineAction(formData: FormData) {
  await requireCurrentEmployee();
  const parsed = bankLineSchema.safeParse({
    bankAccountName: formData.get("bankAccountName"),
    transactionDate: formData.get("transactionDate"),
    direction: formData.get("direction"),
    counterpartyName: formData.get("counterpartyName") ?? "",
    summary: formData.get("summary") ?? "",
    bankReference: formData.get("bankReference") ?? "",
    amount: formData.get("amount"),
  });
  if (!parsed.success) bankRedirect({ error: "银行流水资料不完整" });
  const supabase = await createClient();
  const { error } = await supabase.rpc("register_bank_statement_line", {
    p_bank_account_name: parsed.data.bankAccountName,
    p_transaction_date: parsed.data.transactionDate,
    p_direction: parsed.data.direction,
    p_counterparty_name: parsed.data.counterpartyName || null,
    p_summary: parsed.data.summary || null,
    p_bank_reference: parsed.data.bankReference || null,
    p_amount: parsed.data.amount,
  });
  if (error) {
    console.error("registerBankStatementLineAction failed", error.code);
    bankRedirect({ error: error.code === "23505" ? "该银行流水号已经登记" : "银行流水登记失败，请检查财务权限" });
  }
  revalidatePath("/finance/bank-reconciliation");
  bankRedirect({ created: "银行流水已登记" });
}

const reconciliationSchema = z.object({
  bankStatementLineId: z.uuid(),
  financeDocumentId: z.uuid(),
  amount: z.coerce.number().positive().max(100000000),
  reconciledOn: z.iso.date(),
  debitAccount: z.string().trim().min(2).max(120),
  creditAccount: z.string().trim().min(2).max(120),
  note: z.string().trim().max(500),
});

export async function reconcileBankStatementLineAction(formData: FormData) {
  await requireCurrentEmployee();
  const parsed = reconciliationSchema.safeParse({
    bankStatementLineId: formData.get("bankStatementLineId"),
    financeDocumentId: formData.get("financeDocumentId"),
    amount: formData.get("amount"),
    reconciledOn: formData.get("reconciledOn"),
    debitAccount: formData.get("debitAccount"),
    creditAccount: formData.get("creditAccount"),
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) bankRedirect({ error: "核销资料不完整，请检查金额和会计科目" }, "reconcile");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reconcile_bank_statement_line", {
    p_bank_statement_line_id: parsed.data.bankStatementLineId,
    p_finance_document_id: parsed.data.financeDocumentId,
    p_amount: parsed.data.amount,
    p_reconciled_on: parsed.data.reconciledOn,
    p_debit_account: parsed.data.debitAccount,
    p_credit_account: parsed.data.creditAccount,
    p_note: parsed.data.note || null,
  });
  if (error || !data) {
    console.error("reconcileBankStatementLineAction failed", error?.code);
    bankRedirect({ error: "银行核销失败，请检查流水方向、可核销余额和单据状态" }, "reconcile");
  }
  const result = data as { settlementNo?: string };
  revalidatePath("/finance/bank-reconciliation");
  revalidatePath("/finance");
  bankRedirect({ created: result.settlementNo ? `核销单 ${result.settlementNo} 已生成` : "银行核销已完成" }, "reconcile");
}
