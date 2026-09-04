"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import { createClient } from "@/lib/supabase/server";

function salesRedirect(params: Record<string, string>): never {
  redirect(`/sales?${new URLSearchParams(params).toString()}`);
}

function parseItems(value: FormDataEntryValue | null) {
  try {
    return JSON.parse(String(value ?? "[]")) as unknown;
  } catch {
    return null;
  }
}

const opportunitySchema = z.object({
  customerId: z.uuid(),
  legalEntityId: z.union([z.uuid(), z.literal("")]),
  title: z.string().trim().min(2).max(120),
  expectedAmountCny: z.coerce.number().min(0).max(100_000_000),
  probability: z.coerce.number().int().min(0).max(100),
  expectedCloseOn: z.union([z.iso.date(), z.literal("")]),
  source: z.string().trim().max(100),
  nextAction: z.string().trim().max(500),
  note: z.string().trim().max(1000),
});

export async function createSalesOpportunityAction(formData: FormData) {
  await requireCurrentEmployee();
  const parsed = opportunitySchema.safeParse({
    customerId: formData.get("customerId"),
    legalEntityId: formData.get("legalEntityId") ?? "",
    title: formData.get("title"),
    expectedAmountCny: formData.get("expectedAmountCny"),
    probability: formData.get("probability"),
    expectedCloseOn: formData.get("expectedCloseOn") ?? "",
    source: formData.get("source") ?? "",
    nextAction: formData.get("nextAction") ?? "",
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) {
    salesRedirect({ error: "销售机会资料不完整，请检查客户、金额和预计成交信息" });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_sales_opportunity", {
    p_customer_id: parsed.data.customerId,
    p_legal_entity_id: parsed.data.legalEntityId || null,
    p_title: parsed.data.title,
    p_expected_amount_cny: parsed.data.expectedAmountCny,
    p_probability: parsed.data.probability,
    p_expected_close_on: parsed.data.expectedCloseOn || null,
    p_source: parsed.data.source || null,
    p_next_action: parsed.data.nextAction || null,
    p_note: parsed.data.note || null,
  });
  if (error || !data) {
    console.error("createSalesOpportunityAction failed", error?.code);
    salesRedirect({
      error:
        error?.code === "42501"
          ? "当前账号无权创建销售机会"
          : "销售机会创建失败，请确认数据库迁移和客户资料",
    });
  }
  const result = data as { opportunityNo?: string };
  revalidatePath("/sales");
  salesRedirect({
    created: result.opportunityNo
      ? `销售机会 ${result.opportunityNo} 已创建`
      : "销售机会已创建",
  });
}

const orderItemSchema = z.object({
  productId: z.uuid(),
  quantity: z.coerce.number().positive().max(999999),
});

const orderSchema = z.object({
  customerId: z.uuid(),
  legalEntityId: z.uuid(),
  opportunityId: z.union([z.uuid(), z.literal("")]),
  priceType: z.enum(["retail", "group", "dropship"]),
  orderDate: z.iso.date(),
  requestedDeliveryOn: z.union([z.iso.date(), z.literal("")]),
  paymentTerms: z.string().trim().max(500),
  deliveryTerms: z.string().trim().max(500),
  note: z.string().trim().max(1000),
  items: z.array(orderItemSchema).min(1).max(100),
});

export async function createSalesOrderAction(formData: FormData) {
  await requireCurrentEmployee();
  const returnPath = formData.get("returnTo") === "/mobile/orders/new" ? "/mobile/orders/new" : "/sales";
  const submitForApproval = formData.get("submitForApproval") === "true";
  const orderRedirect = (params: Record<string, string>): never => redirect(`${returnPath}?${new URLSearchParams(params).toString()}`);
  const parsed = orderSchema.safeParse({
    customerId: formData.get("customerId"),
    legalEntityId: formData.get("legalEntityId") ?? "",
    opportunityId: formData.get("opportunityId") ?? "",
    priceType: formData.get("priceType"),
    orderDate: formData.get("orderDate"),
    requestedDeliveryOn: formData.get("requestedDeliveryOn") ?? "",
    paymentTerms: formData.get("paymentTerms") ?? "",
    deliveryTerms: formData.get("deliveryTerms") ?? "",
    note: formData.get("note") ?? "",
    items: parseItems(formData.get("items")),
  });
  if (!parsed.success) {
    return orderRedirect({ error: "销售订单资料不正确，请检查客户、日期和商品数量" });
  }
  if (
    new Set(parsed.data.items.map((item) => item.productId)).size !==
    parsed.data.items.length
  ) {
    return orderRedirect({ error: "同一商品不能在订单中重复添加" });
  }
  if (
    parsed.data.requestedDeliveryOn &&
    parsed.data.requestedDeliveryOn < parsed.data.orderDate
  ) {
    return orderRedirect({ error: "要求交付日期不能早于订单日期" });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_sales_order", {
    p_customer_id: parsed.data.customerId,
    p_legal_entity_id: parsed.data.legalEntityId,
    p_opportunity_id: parsed.data.opportunityId || null,
    p_price_type: parsed.data.priceType,
    p_order_date: parsed.data.orderDate,
    p_requested_delivery_on: parsed.data.requestedDeliveryOn || null,
    p_payment_terms: parsed.data.paymentTerms || null,
    p_delivery_terms: parsed.data.deliveryTerms || null,
    p_note: parsed.data.note || null,
    p_items: parsed.data.items,
  });
  if (error || !data) {
    console.error("createSalesOrderAction failed", error?.code);
    const message = error?.message ?? "";
    return orderRedirect({
      error: message.includes("未配置当前价格")
        ? "订单商品缺少所选价格口径，请先完善产品价格"
        : error?.code === "42501"
          ? "当前账号无权创建销售订单"
          : "销售订单创建失败，请确认数据库迁移和客户资料",
    });
  }
  const result = data as { id?: string; orderNo?: string };
  if (submitForApproval && result.id) {
    const approvalResult = await supabase.rpc("transition_sales_order", {
      p_order_id: result.id,
      p_target_status: "confirmed",
      p_note: "移动端创建并提交审批",
    });
    if (approvalResult.error) {
      console.error("mobile sales order approval submission failed", approvalResult.error.code);
      revalidatePath("/sales");
      orderRedirect({ error: "订单草稿已保存，但提交审批失败，请到销售订单中重试" });
    }
  }
  revalidatePath("/sales");
  revalidatePath("/mobile");
  orderRedirect({
    created: result.orderNo
      ? `销售订单 ${result.orderNo} ${submitForApproval ? "已提交审批" : "已保存为草稿"}`
      : submitForApproval ? "销售订单已提交审批" : "销售订单已保存为草稿",
  });
}

const transitionSchema = z.object({
  orderId: z.uuid(),
  targetStatus: z.enum(["confirmed", "cancelled"]),
  note: z.string().trim().max(1000),
});

export async function transitionSalesOrderAction(formData: FormData) {
  await requireCurrentEmployee();
  const parsed = transitionSchema.safeParse({
    orderId: formData.get("orderId"),
    targetStatus: formData.get("targetStatus"),
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) {
    salesRedirect({ error: "销售订单状态操作无效" });
  }
  if (parsed.data.targetStatus === "cancelled" && parsed.data.note.length < 2) {
    salesRedirect({ error: "取消销售订单必须填写原因" });
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("transition_sales_order", {
    p_order_id: parsed.data.orderId,
    p_target_status: parsed.data.targetStatus,
    p_note: parsed.data.note || null,
  });
  if (error) {
    console.error("transitionSalesOrderAction failed", error.code);
    salesRedirect({
      error: error.message.includes("法律实体")
        ? "确认订单前必须绑定客户法律实体"
        : error.code === "42501"
          ? "当前账号无权更新销售订单"
          : "当前订单状态不允许执行此操作",
    });
  }
  revalidatePath("/sales");
  salesRedirect({
    updated:
      parsed.data.targetStatus === "confirmed"
        ? "销售订单已确认，下一步可进入履约与出库"
        : "销售订单已取消",
  });
}

const fulfillmentSchema = z.object({
  orderId: z.uuid(),
  warehouseId: z.uuid(),
  recipientName: z.string().trim().max(80),
  recipientPhone: z.string().trim().max(40),
  deliveryAddress: z.string().trim().min(2).max(300),
  note: z.string().trim().max(500),
  items: z.array(z.object({ orderItemId: z.uuid(), quantity: z.coerce.number().positive().max(999999) })).min(1).max(100),
});

export async function fulfillSalesOrderAction(formData: FormData) {
  await requireCurrentEmployee();
  const parsed = fulfillmentSchema.safeParse({
    orderId: formData.get("orderId"),
    warehouseId: formData.get("warehouseId"),
    recipientName: formData.get("recipientName") ?? "",
    recipientPhone: formData.get("recipientPhone") ?? "",
    deliveryAddress: formData.get("deliveryAddress") ?? "",
    note: formData.get("note") ?? "",
    items: parseItems(formData.get("items")),
  });
  if (!parsed.success) {
    salesRedirect({ error: "请完整填写履约仓库和配送地址" });
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fulfill_sales_order_v2", {
    p_order_id: parsed.data.orderId,
    p_warehouse_id: parsed.data.warehouseId,
    p_recipient_name: parsed.data.recipientName || null,
    p_recipient_phone: parsed.data.recipientPhone || null,
    p_delivery_address: parsed.data.deliveryAddress,
    p_note: parsed.data.note || null,
    p_items: parsed.data.items,
  });
  if (error || !data) {
    console.error("fulfillSalesOrderAction failed", error?.code);
    salesRedirect({
      error: error?.message.includes("库存不足")
        ? "所选仓库可用库存不足，履约未执行"
        : error?.code === "42501"
          ? "只有仓储人员或管理员可以执行销售履约"
          : "销售履约失败，请检查订单状态、仓库和法律实体",
    });
  }
  const result = data as { outboundNo?: string; deliveryNo?: string; receivableNo?: string };
  revalidatePath("/sales");
  revalidatePath("/inventory");
  revalidatePath("/inventory/operations");
  revalidatePath("/finance"); revalidatePath("/finance/receivables"); revalidatePath(`/sales/orders/${parsed.data.orderId}`);
  salesRedirect({
    updated: `履约完成：出库单 ${result.outboundNo ?? "-"}，配送单 ${result.deliveryNo ?? "-"}，应收单 ${result.receivableNo ?? "-"}`,
  });
}
