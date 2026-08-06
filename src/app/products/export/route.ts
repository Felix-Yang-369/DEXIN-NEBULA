import { getCurrentEmployee } from "@/features/auth/current-employee";
import {
  buildProductMasterWorkbook,
  type ProductExportPrice,
  type ProductExportRow,
} from "@/features/products/export-workbook";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function timestamp(value: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .formatToParts(value)
    .filter((part) => part.type !== "literal")
    .reduce<Record<string, string>>((result, part) => {
      result[part.type] = part.value;
      return result;
    }, {});
}

export async function GET(request: Request) {
  const employee = await getCurrentEmployee();
  if (!employee) {
    return Response.redirect(
      new URL("/login?next=%2Fproducts", request.url),
      307,
    );
  }

  const supabase = await createClient();
  const [productResult, priceResult] = await Promise.all([
    supabase
      .from("products")
      .select(
        "id, code, image_path, barcode, category, source_category, brand, short_name, name, name_en, specification, case_specification, shelf_life, tax_rate, minimum_order, stock_status, supports_dropship, is_recommended, applicable_scenarios, description, delivery_notes, invoice_notes, alternative_product_codes, keywords, customer_query_reply, out_of_stock_reply, order_guide_reply",
      )
      .order("code")
      .limit(5000),
    supabase
      .from("product_prices")
      .select("product_id, price_type, amount_cny")
      .eq("status", "active")
      .limit(20000),
  ]);

  if (productResult.error || priceResult.error) {
    console.error("product export query failed", {
      products: productResult.error?.code,
      prices: priceResult.error?.code,
    });
    return Response.json(
      { error: "产品数据读取失败，请稍后重试" },
      { status: 500 },
    );
  }

  const exportedAt = new Date();
  const buffer = await buildProductMasterWorkbook({
    products: (productResult.data ?? []) as ProductExportRow[],
    prices: (priceResult.data ?? []) as ProductExportPrice[],
    employeeName: employee.name,
    exportedAt,
  });
  const parts = timestamp(exportedAt);
  const stamp = `${parts.year}${parts.month}${parts.day}-${parts.hour}${parts.minute}`;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Disposition": `attachment; filename="dexin-product-master-${stamp}.xlsx"; filename*=UTF-8''${encodeURIComponent(`德馨产品库总表_${stamp}.xlsx`)}`,
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
