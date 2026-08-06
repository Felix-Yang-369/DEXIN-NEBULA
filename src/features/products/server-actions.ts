"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import { createClient } from "@/lib/supabase/server";

const productUpdateSchema = z.object({
  productId: z.string().uuid(),
  stockStatus: z.string().max(80),
  minimumOrder: z.string().max(80),
  isRecommended: z.boolean(),
  status: z.enum(["draft", "active", "archived"]),
});

function productsRedirect(params: Record<string, string>): never {
  redirect(`/products?${new URLSearchParams(params).toString()}`);
}

export async function updateProductMaster(formData: FormData) {
  await requireCurrentEmployee();

  const parsed = productUpdateSchema.safeParse({
    productId: String(formData.get("productId") ?? ""),
    stockStatus: String(formData.get("stockStatus") ?? "").trim(),
    minimumOrder: String(formData.get("minimumOrder") ?? "").trim(),
    isRecommended: formData.get("isRecommended") === "on",
    status: String(formData.get("status") ?? ""),
  });

  if (!parsed.success) {
    productsRedirect({ error: "产品资料格式不正确，请检查后重试" });
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_product_master", {
    p_product_id: parsed.data.productId,
    p_stock_status: parsed.data.stockStatus,
    p_minimum_order: parsed.data.minimumOrder,
    p_is_recommended: parsed.data.isRecommended,
    p_status: parsed.data.status,
  });

  if (error) {
    console.error("updateProductMaster failed", error.code);
    productsRedirect({ error: "产品资料更新失败，请确认维护权限" });
  }

  revalidatePath("/products");
  productsRedirect({
    product: parsed.data.productId,
    updated: "产品资料已更新",
  });
}

const optionalNumber = z.preprocess(
  (value) =>
    value === "" || value === null || value === undefined
      ? null
      : Number(value),
  z.number().min(0).nullable(),
);

function textArray(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split(/[，,、\n]/)
    .map((item) => item.trim())
    .filter((item, index, values) => item && values.indexOf(item) === index);
}

export async function saveProductFullAction(formData: FormData) {
  await requireCurrentEmployee();
  const schema = z.object({
    productId: z.preprocess(
      (value) => (value === "" || value === null ? null : value),
      z.uuid().nullable(),
    ),
    code: z.string().trim().min(3).max(40),
    category: z.enum(["rice", "oil", "gift"]),
    sourceCategory: z.string().trim().max(80),
    barcode: z.string().trim().max(80),
    brand: z.string().trim().max(100),
    shortName: z.string().trim().min(2).max(160),
    name: z.string().trim().min(2).max(500),
    nameEn: z.string().trim().max(500),
    specification: z.string().trim().max(160),
    caseSpecification: z.string().trim().max(160),
    shelfLife: z.string().trim().max(80),
    taxRatePercent: z.coerce.number().min(0).max(100),
    minimumOrder: z.string().trim().max(80),
    stockStatus: z.string().trim().max(100),
    supportsDropship: z.boolean(),
    isRecommended: z.boolean(),
    applicableScenarios: z.string().trim().max(1000),
    description: z.string().trim().max(5000),
    deliveryNotes: z.string().trim().max(3000),
    invoiceNotes: z.string().trim().max(2000),
    customerQueryReply: z.string().trim().max(5000),
    outOfStockReply: z.string().trim().max(5000),
    orderGuideReply: z.string().trim().max(5000),
    status: z.enum(["draft", "active", "archived"]),
    procurementPrice: optionalNumber,
    retailPrice: optionalNumber,
    groupPrice: optionalNumber,
    dropshipPrice: optionalNumber,
  });
  const parsed = schema.safeParse({
    productId: formData.get("productId"),
    code: formData.get("code"),
    category: formData.get("category"),
    sourceCategory: formData.get("sourceCategory") ?? "",
    barcode: formData.get("barcode") ?? "",
    brand: formData.get("brand") ?? "",
    shortName: formData.get("shortName"),
    name: formData.get("name"),
    nameEn: formData.get("nameEn") ?? "",
    specification: formData.get("specification") ?? "",
    caseSpecification: formData.get("caseSpecification") ?? "",
    shelfLife: formData.get("shelfLife") ?? "",
    taxRatePercent: formData.get("taxRatePercent") ?? "0",
    minimumOrder: formData.get("minimumOrder") ?? "",
    stockStatus: formData.get("stockStatus") ?? "",
    supportsDropship: formData.get("supportsDropship") === "on",
    isRecommended: formData.get("isRecommended") === "on",
    applicableScenarios: formData.get("applicableScenarios") ?? "",
    description: formData.get("description") ?? "",
    deliveryNotes: formData.get("deliveryNotes") ?? "",
    invoiceNotes: formData.get("invoiceNotes") ?? "",
    customerQueryReply: formData.get("customerQueryReply") ?? "",
    outOfStockReply: formData.get("outOfStockReply") ?? "",
    orderGuideReply: formData.get("orderGuideReply") ?? "",
    status: formData.get("status"),
    procurementPrice: formData.get("procurementPrice"),
    retailPrice: formData.get("retailPrice"),
    groupPrice: formData.get("groupPrice"),
    dropshipPrice: formData.get("dropshipPrice"),
  });
  if (!parsed.success) {
    productsRedirect({ error: "产品完整主档格式不正确，请检查必填字段" });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_product_full", {
    p_product_id: parsed.data.productId,
    p_code: parsed.data.code,
    p_category: parsed.data.category,
    p_source_category: parsed.data.sourceCategory || null,
    p_barcode: parsed.data.barcode || null,
    p_brand: parsed.data.brand || null,
    p_short_name: parsed.data.shortName,
    p_name: parsed.data.name,
    p_name_en: parsed.data.nameEn || null,
    p_specification: parsed.data.specification || null,
    p_case_specification: parsed.data.caseSpecification || null,
    p_shelf_life: parsed.data.shelfLife || null,
    p_tax_rate: parsed.data.taxRatePercent / 100,
    p_minimum_order: parsed.data.minimumOrder || null,
    p_stock_status: parsed.data.stockStatus || null,
    p_supports_dropship: parsed.data.supportsDropship,
    p_is_recommended: parsed.data.isRecommended,
    p_applicable_scenarios: parsed.data.applicableScenarios || null,
    p_description: parsed.data.description || null,
    p_delivery_notes: parsed.data.deliveryNotes || null,
    p_invoice_notes: parsed.data.invoiceNotes || null,
    p_alternative_product_codes: textArray(
      formData.get("alternativeProductCodes"),
    ),
    p_keywords: textArray(formData.get("keywords")),
    p_customer_query_reply: parsed.data.customerQueryReply || null,
    p_out_of_stock_reply: parsed.data.outOfStockReply || null,
    p_order_guide_reply: parsed.data.orderGuideReply || null,
    p_status: parsed.data.status,
    p_procurement_price: parsed.data.procurementPrice,
    p_retail_price: parsed.data.retailPrice,
    p_group_price: parsed.data.groupPrice,
    p_dropship_price: parsed.data.dropshipPrice,
  });
  if (error || !data) {
    console.error("saveProductFullAction failed", error?.code);
    productsRedirect({
      error: error?.message.includes("编号")
        ? "产品编号已存在"
        : "产品主档保存失败，请确认维护权限",
    });
  }

  revalidatePath("/products");
  productsRedirect({
    product: data,
    view: "table",
    updated: parsed.data.productId ? "产品完整主档已更新" : "新产品已创建",
  });
}

const productImageMimeTypes = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export async function uploadProductImageAction(formData: FormData) {
  const employee = await requireCurrentEmployee();
  const productId = String(formData.get("productId") ?? "");
  const file = formData.get("image");

  if (
    !z.uuid().safeParse(productId).success ||
    !(file instanceof File) ||
    file.size === 0 ||
    file.size > 5 * 1024 * 1024 ||
    !(file.type in productImageMimeTypes)
  ) {
    productsRedirect({
      product: productId,
      error: "请选择 5MB 以内的 PNG、JPG 或 WebP 产品图",
    });
  }

  const supabase = await createClient();
  const [{ data: product }, { data: canManage }] = await Promise.all([
    supabase
      .from("products")
      .select("code, image_path")
      .eq("id", productId)
      .maybeSingle(),
    supabase.rpc("can_manage_products"),
  ]);
  if (!product || !canManage) {
    productsRedirect({ product: productId, error: "无权维护产品图片" });
  }

  const extension =
    productImageMimeTypes[file.type as keyof typeof productImageMimeTypes];
  const imagePath = `${employee.organizationId}/${product.code}/product.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from("product-images")
    .upload(imagePath, file, {
      contentType: file.type,
      upsert: true,
    });
  if (uploadError) {
    console.error("uploadProductImageAction storage failed", uploadError.message);
    productsRedirect({
      product: productId,
      error: "产品图片上传失败，请稍后重试",
    });
  }

  const { error: saveError } = await supabase.rpc("set_product_image", {
    p_product_id: productId,
    p_image_path: imagePath,
  });
  if (saveError) {
    console.error("uploadProductImageAction profile failed", saveError.code);
    if (product.image_path !== imagePath) {
      await supabase.storage.from("product-images").remove([imagePath]);
    }
    productsRedirect({
      product: productId,
      error: "产品图片保存失败，请确认维护权限",
    });
  }

  if (product.image_path && product.image_path !== imagePath) {
    await supabase.storage.from("product-images").remove([product.image_path]);
  }

  revalidatePath("/products");
  productsRedirect({
    product: productId,
    view: "table",
    updated: "产品图片已更新",
  });
}
