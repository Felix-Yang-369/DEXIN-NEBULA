"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import { createClient } from "@/lib/supabase/server";

const optionalUuid = z.preprocess(
  (value) => (value === "" || value === null ? null : value),
  z.uuid().nullable(),
);
const optionalDate = z.preprocess(
  (value) => (value === "" || value === null ? null : value),
  z.iso.date().nullable(),
);

function supplierRedirect(
  href: string,
  params: Record<string, string>,
): never {
  redirect(`${href}?${new URLSearchParams(params).toString()}`);
}

export async function saveSupplierAction(formData: FormData) {
  await requireCurrentEmployee();
  const schema = z.object({
    supplierId: optionalUuid,
    name: z.string().trim().min(2).max(160),
    shortName: z.string().trim().max(80),
    unifiedCreditCode: z.string().trim().max(30),
    category: z.enum([
      "rice",
      "oil",
      "gift",
      "logistics",
      "packaging",
      "service",
      "other",
    ]),
    cooperationLevel: z.enum(["core", "preferred", "standard", "backup"]),
    cooperationStatus: z.enum([
      "candidate",
      "active",
      "suspended",
      "inactive",
    ]),
    legalRepresentative: z.string().trim().max(80),
    businessScope: z.string().trim().max(1000),
    address: z.string().trim().max(500),
    settlementTerms: z.string().trim().max(300),
    ownerEmployeeId: optionalUuid,
    note: z.string().trim().max(1000),
  });
  const parsed = schema.safeParse({
    supplierId: formData.get("supplierId"),
    name: formData.get("name"),
    shortName: formData.get("shortName") ?? "",
    unifiedCreditCode: formData.get("unifiedCreditCode") ?? "",
    category: formData.get("category"),
    cooperationLevel: formData.get("cooperationLevel"),
    cooperationStatus: formData.get("cooperationStatus"),
    legalRepresentative: formData.get("legalRepresentative") ?? "",
    businessScope: formData.get("businessScope") ?? "",
    address: formData.get("address") ?? "",
    settlementTerms: formData.get("settlementTerms") ?? "",
    ownerEmployeeId: formData.get("ownerEmployeeId"),
    note: formData.get("note") ?? "",
  });
  const fallbackHref = parsed.success && parsed.data.supplierId
    ? `/suppliers/${parsed.data.supplierId}`
    : "/suppliers";
  if (!parsed.success) supplierRedirect(fallbackHref, { error: "invalid" });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_supplier", {
    p_supplier_id: parsed.data.supplierId,
    p_name: parsed.data.name,
    p_short_name: parsed.data.shortName || null,
    p_unified_credit_code: parsed.data.unifiedCreditCode || null,
    p_category: parsed.data.category,
    p_cooperation_level: parsed.data.cooperationLevel,
    p_cooperation_status: parsed.data.cooperationStatus,
    p_legal_representative: parsed.data.legalRepresentative || null,
    p_business_scope: parsed.data.businessScope || null,
    p_address: parsed.data.address || null,
    p_settlement_terms: parsed.data.settlementTerms || null,
    p_owner_employee_id: parsed.data.ownerEmployeeId,
    p_note: parsed.data.note || null,
  });
  if (error || !data) {
    supplierRedirect(fallbackHref, {
      error: error?.message.includes("信用代码") ? "duplicate" : "save_failed",
    });
  }

  revalidatePath("/suppliers");
  revalidatePath(`/suppliers/${data}`);
  supplierRedirect(`/suppliers/${data}`, {
    [parsed.data.supplierId ? "updated" : "created"]: "1",
  });
}

export async function addSupplierContactAction(formData: FormData) {
  await requireCurrentEmployee();
  const schema = z.object({
    supplierId: z.uuid(),
    name: z.string().trim().min(2).max(80),
    position: z.string().trim().max(80),
    mobile: z.string().trim().max(30),
    email: z.string().trim().max(160),
    isPrimary: z.boolean(),
    note: z.string().trim().max(500),
  }).refine((value) => value.mobile || value.email, {
    message: "手机号和邮箱至少填写一项",
  });
  const parsed = schema.safeParse({
    supplierId: formData.get("supplierId"),
    name: formData.get("name"),
    position: formData.get("position") ?? "",
    mobile: formData.get("mobile") ?? "",
    email: formData.get("email") ?? "",
    isPrimary: formData.get("isPrimary") === "on",
    note: formData.get("note") ?? "",
  });
  const href = `/suppliers/${String(formData.get("supplierId") ?? "")}`;
  if (!parsed.success) supplierRedirect(href, { error: "invalid_contact" });

  const supabase = await createClient();
  const { error } = await supabase.rpc("add_supplier_contact", {
    p_supplier_id: parsed.data.supplierId,
    p_name: parsed.data.name,
    p_position: parsed.data.position || null,
    p_mobile: parsed.data.mobile || null,
    p_email: parsed.data.email || null,
    p_is_primary: parsed.data.isPrimary,
    p_note: parsed.data.note || null,
  });
  if (error) supplierRedirect(href, { error: "contact_failed" });

  revalidatePath("/suppliers");
  revalidatePath(href);
  supplierRedirect(href, { contactCreated: "1" });
}

export async function addSupplierQualificationAction(formData: FormData) {
  await requireCurrentEmployee();
  const schema = z.object({
    supplierId: z.uuid(),
    qualificationType: z.enum([
      "business_license",
      "food_production",
      "food_operation",
      "brand_authorization",
      "quality_report",
      "other",
    ]),
    name: z.string().trim().min(2).max(160),
    certificateNo: z.string().trim().max(100),
    effectiveOn: optionalDate,
    expiresOn: optionalDate,
    businessDocumentId: optionalUuid,
    note: z.string().trim().max(500),
  }).refine(
    (value) =>
      !value.effectiveOn ||
      !value.expiresOn ||
      value.expiresOn >= value.effectiveOn,
    { message: "到期日期不能早于生效日期" },
  );
  const parsed = schema.safeParse({
    supplierId: formData.get("supplierId"),
    qualificationType: formData.get("qualificationType"),
    name: formData.get("name"),
    certificateNo: formData.get("certificateNo") ?? "",
    effectiveOn: formData.get("effectiveOn"),
    expiresOn: formData.get("expiresOn"),
    businessDocumentId: formData.get("businessDocumentId"),
    note: formData.get("note") ?? "",
  });
  const href = `/suppliers/${String(formData.get("supplierId") ?? "")}`;
  if (!parsed.success) {
    supplierRedirect(href, { error: "invalid_qualification" });
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("add_supplier_qualification", {
    p_supplier_id: parsed.data.supplierId,
    p_qualification_type: parsed.data.qualificationType,
    p_name: parsed.data.name,
    p_certificate_no: parsed.data.certificateNo || null,
    p_effective_on: parsed.data.effectiveOn,
    p_expires_on: parsed.data.expiresOn,
    p_business_document_id: parsed.data.businessDocumentId,
    p_note: parsed.data.note || null,
  });
  if (error) supplierRedirect(href, { error: "qualification_failed" });

  revalidatePath("/suppliers");
  revalidatePath(href);
  supplierRedirect(href, { qualificationCreated: "1" });
}
