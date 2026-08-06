"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import { createClient } from "@/lib/supabase/server";

function stringValue(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function inventoryRedirect(params: Record<string, string>): never {
  const query = new URLSearchParams(params);
  redirect(`/inventory?${query.toString()}`);
}

async function requireInventoryManager() {
  const employee = await requireCurrentEmployee();

  if (!employee.departmentId) {
    inventoryRedirect({ error: "只有仓储人员可以执行此操作" });
  }

  const supabase = await createClient();
  const { data: department } = await supabase
    .from("departments")
    .select("code")
    .eq("id", employee.departmentId)
    .maybeSingle();

  if (department?.code !== "DX-WH") {
    inventoryRedirect({ error: "只有仓储人员可以执行此操作" });
  }

  return employee;
}

export async function createWarehouse(formData: FormData) {
  const employee = await requireInventoryManager();
  const code = stringValue(formData, "code").toUpperCase();
  const name = stringValue(formData, "name");
  const address = stringValue(formData, "address");

  if (!/^[A-Z0-9-]{2,20}$/.test(code)) {
    inventoryRedirect({ error: "仓库编码需为 2 至 20 位字母、数字或横线" });
  }

  if (!name || name.length > 60) {
    inventoryRedirect({ error: "请输入 1 至 60 个字的仓库名称" });
  }

  const supabase = await createClient();
  const { error } = await supabase.from("warehouses").insert({
    organization_id: employee.organizationId,
    code,
    name,
    address: address || null,
  });

  if (error) {
    console.error("createWarehouse failed", error.code);
    inventoryRedirect({ error: "仓库创建失败，请检查编码是否重复" });
  }

  revalidatePath("/inventory");
  inventoryRedirect({ created: `仓库“${name}”已创建` });
}

export async function createInventoryItem(formData: FormData) {
  const employee = await requireInventoryManager();
  const warehouseId = stringValue(formData, "warehouseId");
  const sku = stringValue(formData, "sku").toUpperCase();
  const productName = stringValue(formData, "productName");
  const specification = stringValue(formData, "specification");
  const unit = stringValue(formData, "unit");
  const locationCode = stringValue(formData, "locationCode").toUpperCase();
  const safetyStock = Number(stringValue(formData, "safetyStock") || "0");

  if (!warehouseId) {
    inventoryRedirect({ error: "请选择所属仓库" });
  }

  if (!/^[A-Z0-9_-]{2,40}$/.test(sku)) {
    inventoryRedirect({ error: "SKU 需为 2 至 40 位字母、数字、横线或下划线" });
  }

  if (!productName || productName.length > 100) {
    inventoryRedirect({ error: "请输入 1 至 100 个字的商品名称" });
  }

  if (!unit || unit.length > 10) {
    inventoryRedirect({ error: "请输入正确的计量单位" });
  }

  if (!Number.isFinite(safetyStock) || safetyStock < 0) {
    inventoryRedirect({ error: "安全库存不能小于零" });
  }

  const supabase = await createClient();
  const { error } = await supabase.from("inventory_items").insert({
    organization_id: employee.organizationId,
    warehouse_id: warehouseId,
    sku,
    product_name: productName,
    specification: specification || null,
    unit,
    location_code: locationCode || null,
    safety_stock: safetyStock,
  });

  if (error) {
    console.error("createInventoryItem failed", error.code);
    inventoryRedirect({ error: "SKU 创建失败，请检查仓库和编码是否重复" });
  }

  revalidatePath("/inventory");
  inventoryRedirect({ created: `SKU ${sku} 已加入库存` });
}

export async function recordInventoryMovement(formData: FormData) {
  await requireInventoryManager();
  const inventoryItemId = stringValue(formData, "inventoryItemId");
  const movementType = stringValue(formData, "movementType");
  const quantity = Number(stringValue(formData, "quantity"));
  const referenceNo = stringValue(formData, "referenceNo");
  const note = stringValue(formData, "note");
  const productionDate = stringValue(formData, "productionDate");
  const shelfLifeMonthsValue = stringValue(formData, "shelfLifeMonths");
  const shelfLifeMonths = shelfLifeMonthsValue
    ? Number(shelfLifeMonthsValue)
    : null;

  if (!inventoryItemId) {
    inventoryRedirect({ error: "请选择库存商品" });
  }

  if (!["inbound", "outbound"].includes(movementType)) {
    inventoryRedirect({ error: "请选择正确的出入库类型" });
  }

  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 100000000) {
    inventoryRedirect({ error: "请输入有效的出入库数量" });
  }

  if (
    productionDate &&
    !/^\d{4}-\d{2}-\d{2}$/.test(productionDate)
  ) {
    inventoryRedirect({ error: "生产日期格式无效" });
  }

  if (
    shelfLifeMonths !== null &&
    (!Number.isInteger(shelfLifeMonths) ||
      shelfLifeMonths <= 0 ||
      shelfLifeMonths > 120)
  ) {
    inventoryRedirect({ error: "保质期应为 1 至 120 个月" });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("record_inventory_movement", {
    p_inventory_item_id: inventoryItemId,
    p_movement_type: movementType,
    p_quantity: quantity,
    p_reference_no: referenceNo || null,
    p_note: note || null,
    p_production_date: productionDate || null,
    p_shelf_life_months: shelfLifeMonths,
  });

  if (error) {
    console.error("recordInventoryMovement failed", error.code);
    inventoryRedirect({
      error:
        error.code === "23514"
          ? "出库数量超过当前可用库存，隔离或预留库存不可出库"
          : "出入库登记失败，请检查权限或稍后重试",
    });
  }

  const result = data as { movementNo?: string } | null;
  revalidatePath("/inventory");
  inventoryRedirect({
    created: result?.movementNo
      ? `库存流水 ${result.movementNo} 已完成`
      : "库存已更新",
  });
}
