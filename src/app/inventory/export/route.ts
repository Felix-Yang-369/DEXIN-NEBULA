import { getCurrentEmployee } from "@/features/auth/current-employee";
import {
  buildWanweiInventoryWorkbook,
  type InventoryExportBatch,
  type InventoryExportItem,
} from "@/features/inventory/export-workbook";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function shanghaiTimestamp(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .formatToParts(value)
    .reduce<Record<string, string>>((result, part) => {
      if (part.type !== "literal") {
        result[part.type] = part.value;
      }
      return result;
    }, {});

  return `${parts.year}${parts.month}${parts.day}-${parts.hour}${parts.minute}`;
}

export async function GET(request: Request) {
  const employee = await getCurrentEmployee();

  if (!employee) {
    return Response.redirect(
      new URL("/login?next=%2Finventory", request.url),
      307,
    );
  }

  const supabase = await createClient();
  const [inventoryResult, batchResult] = await Promise.all([
    supabase
      .from("inventory_items")
      .select(
        "id, product_id, sku, product_name, specification, category, barcode, case_specification, unit, location_code, quantity, available_quantity, reserved_quantity, quarantined_quantity, safety_stock, warehouses(code, name, warehouse_type, partner_name)",
      )
      .eq("status", "active")
      .order("product_name")
      .limit(5000),
    supabase
      .from("inventory_batches")
      .select(
        "id, source_row_no, production_date, shelf_life_months, expiry_date, quantity, reserved_quantity, status, note, inventory_items(sku, product_name, specification, category, barcode, case_specification, unit), warehouses(name)",
      )
      .order("source_row_no", { ascending: true, nullsFirst: false })
      .limit(10000),
  ]);

  if (inventoryResult.error || batchResult.error) {
    console.error("inventory export query failed", {
      inventory: inventoryResult.error?.code,
      batches: batchResult.error?.code,
    });
    return Response.json(
      { error: "仓储数据读取失败，请稍后重试" },
      { status: 500 },
    );
  }

  const inventory = (inventoryResult.data ?? []) as InventoryExportItem[];
  const batches = (batchResult.data ?? []) as InventoryExportBatch[];
  const exportedAt = new Date();
  const buffer = await buildWanweiInventoryWorkbook({
    employeeName: employee.name,
    exportedAt,
    batches,
  });

  const { error: auditError } = await supabase.rpc(
    "record_inventory_export_audit",
    {
      p_inventory_rows: inventory.length,
      p_batch_rows: batches.length,
      p_movement_rows: 0,
    },
  );
  if (auditError) {
    console.error("inventory export audit failed", auditError.code);
  }

  const timestamp = shanghaiTimestamp(exportedAt);
  const chineseFileName = `万纬库存表_${timestamp}.xlsx`;
  const asciiFileName = `wanwei-inventory-${timestamp}.xlsx`;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Disposition": `attachment; filename="${asciiFileName}"; filename*=UTF-8''${encodeURIComponent(chineseFileName)}`,
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
