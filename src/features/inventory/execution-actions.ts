"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import { createClient } from "@/lib/supabase/server";

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function done(params: Record<string, string>): never {
  redirect(`/inventory/operations?${new URLSearchParams(params)}`);
}

async function rpc(name: string, args: Record<string, unknown>) {
  await requireCurrentEmployee();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(name, args);
  if (error) {
    console.error(`${name} failed`, error.code);
    done({ error: error.message.includes("库存不足") ? "可用库存不足，操作未执行" : "操作失败，请检查数据、状态或当前账号权限" });
  }
  revalidatePath("/inventory");
  revalidatePath("/inventory/operations");
  return data as Record<string, unknown> | null;
}

export async function createOutbound(formData: FormData) {
  const quantity = Number(value(formData, "quantity"));
  if (!Number.isFinite(quantity) || quantity <= 0) done({ error: "请输入正确的出库数量" });
  const result = await rpc("create_inventory_outbound", {
    p_warehouse_id: value(formData, "warehouseId"),
    p_source_type: value(formData, "sourceType"),
    p_source_no: value(formData, "sourceNo") || null,
    p_requested_on: value(formData, "requestedOn") || null,
    p_recipient_name: value(formData, "recipientName") || null,
    p_recipient_phone: value(formData, "recipientPhone") || null,
    p_delivery_address: value(formData, "deliveryAddress") || null,
    p_note: value(formData, "note") || null,
    p_items: [{ inventoryItemId: value(formData, "inventoryItemId"), quantity }],
  });
  done({ created: `出库单 ${String(result?.outboundNo ?? "")} 已创建，等待确认执行` });
}

export async function completeOutbound(formData: FormData) {
  const result = await rpc("complete_inventory_outbound", { p_outbound_id: value(formData, "outboundId") });
  done({ created: `出库完成，配送单 ${String(result?.deliveryNo ?? "")} 已生成` });
}

export async function executeTransfer(formData: FormData) {
  const quantity = Number(value(formData, "quantity"));
  if (!Number.isFinite(quantity) || quantity <= 0) done({ error: "请输入正确的调拨数量" });
  const result = await rpc("execute_inventory_transfer", {
    p_source_item_id: value(formData, "sourceItemId"),
    p_destination_warehouse_id: value(formData, "destinationWarehouseId"),
    p_quantity: quantity,
    p_transferred_on: value(formData, "transferredOn"),
    p_note: value(formData, "note") || null,
  });
  done({ created: `仓库调拨 ${String(result?.transferNo ?? "")} 已完成` });
}

export async function completeStocktake(formData: FormData) {
  const countedQuantity = Number(value(formData, "countedQuantity"));
  if (!Number.isFinite(countedQuantity) || countedQuantity < 0) done({ error: "实盘数量不能小于零" });
  const result = await rpc("complete_inventory_stocktake", {
    p_warehouse_id: value(formData, "warehouseId"),
    p_counted_on: value(formData, "countedOn"),
    p_note: value(formData, "note") || null,
    p_items: [{ inventoryItemId: value(formData, "inventoryItemId"), countedQuantity }],
  });
  done({ created: `盘点单 ${String(result?.stocktakeNo ?? "")} 已完成，差异商品 ${String(result?.differenceLines ?? 0)} 项` });
}

export async function updateDelivery(formData: FormData) {
  await rpc("update_delivery_record", {
    p_delivery_id: value(formData, "deliveryId"),
    p_status: value(formData, "status"),
    p_carrier_name: value(formData, "carrierName") || null,
    p_driver_name: value(formData, "driverName") || null,
    p_driver_phone: value(formData, "driverPhone") || null,
    p_vehicle_no: value(formData, "vehicleNo") || null,
    p_exception_note: value(formData, "exceptionNote") || null,
  });
  done({ created: "配送状态已更新" });
}
