"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import { createClient } from "@/lib/supabase/server";
const uuid = z.uuid();
const text = z.string().trim().max(500);
function go(path: string, message: string, error = false): never {
  redirect(
    `${path}?${error ? "error" : "created"}=${encodeURIComponent(message)}`,
  );
}
export async function createRfqAction(fd: FormData) {
  await requireCurrentEmployee();
  const p = z
    .object({
      request: z.union([uuid, z.literal("")]),
      title: z.string().trim().min(2).max(120),
      due: z.union([z.iso.datetime({ local: true }), z.literal("")]),
      suppliers: z.array(uuid).min(2).max(20),
    })
    .safeParse({
      request: fd.get("requestId") ?? "",
      title: fd.get("title"),
      due: fd.get("dueAt") ?? "",
      suppliers: fd.getAll("supplierIds"),
    });
  if (!p.success) go("/purchasing/control", "至少选择两家有效供应商", true);
  const s = await createClient();
  const { error } = await s.rpc("create_procurement_rfq", {
    p_purchase_request_id: p.data.request || null,
    p_title: p.data.title,
    p_due_at: p.data.due ? new Date(p.data.due).toISOString() : null,
    p_supplier_ids: p.data.suppliers,
  });
  if (error) go("/purchasing/control", "询价单创建失败", true);
  revalidatePath("/purchasing/control");
  go("/purchasing/control", "询价单已创建");
}
export async function recordQuoteAction(fd: FormData) {
  await requireCurrentEmployee();
  const p = z
    .object({
      rfq: uuid,
      supplier: uuid,
      amount: z.coerce.number().nonnegative(),
      promised: z.union([z.iso.date(), z.literal("")]),
      terms: text,
      score: z.coerce.number().min(0).max(100),
      note: text,
    })
    .safeParse({
      rfq: fd.get("rfqId"),
      supplier: fd.get("supplierId"),
      amount: fd.get("amount"),
      promised: fd.get("promisedOn") ?? "",
      terms: fd.get("paymentTerms") ?? "",
      score: fd.get("score"),
      note: fd.get("note") ?? "",
    });
  if (!p.success) go("/purchasing/control", "报价资料无效", true);
  const s = await createClient();
  const { error } = await s.rpc("record_procurement_quote", {
    p_rfq_id: p.data.rfq,
    p_supplier_id: p.data.supplier,
    p_amount: p.data.amount,
    p_promised_on: p.data.promised || null,
    p_payment_terms: p.data.terms,
    p_score: p.data.score,
    p_note: p.data.note,
  });
  if (error) go("/purchasing/control", "报价登记失败", true);
  revalidatePath("/purchasing/control");
  go("/purchasing/control", "报价已登记");
}
export async function inspectReceiptAction(fd: FormData) {
  await requireCurrentEmployee();
  const p = z
    .object({
      receipt: uuid,
      accepted: z.coerce.number().nonnegative(),
      rejected: z.coerce.number().nonnegative(),
      reason: text,
    })
    .safeParse({
      receipt: fd.get("receiptId"),
      accepted: fd.get("acceptedQuantity"),
      rejected: fd.get("rejectedQuantity"),
      reason: fd.get("reason") ?? "",
    });
  if (!p.success) go("/purchasing/control", "质检数量无效", true);
  const s = await createClient();
  const { error } = await s.rpc("inspect_goods_receipt", {
    p_goods_receipt_id: p.data.receipt,
    p_accepted_quantity: p.data.accepted,
    p_rejected_quantity: p.data.rejected,
    p_defect_reason: p.data.reason,
  });
  if (error) go("/purchasing/control", "质检失败，请确认数量与到货一致", true);
  revalidatePath("/purchasing/control");
  go("/purchasing/control", "质检完成");
}
export async function matchProcurementAction(fd: FormData) {
  await requireCurrentEmployee();
  const id = uuid.safeParse(fd.get("documentId"));
  if (!id.success) go("/purchasing/control", "应付单无效", true);
  const s = await createClient();
  const { data, error } = await s.rpc("perform_procurement_three_way_match", {
    p_finance_document_id: id.data,
    p_tolerance: 1,
  });
  if (error) go("/purchasing/control", "三单匹配失败", true);
  revalidatePath("/purchasing/control");
  go("/purchasing/control", `匹配结果：${String(data)}`);
}
export async function completePurchaseReturnAction(fd: FormData) {
  await requireCurrentEmployee();
  const parsed = z
    .object({ inspectionId: uuid, reason: z.string().trim().min(2).max(300) })
    .safeParse({
      inspectionId: fd.get("inspectionId"),
      reason: fd.get("reason"),
    });
  if (!parsed.success) go("/purchasing/control", "退货资料无效", true);
  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_purchase_return", {
    p_inspection_id: parsed.data.inspectionId,
    p_reason: parsed.data.reason,
  });
  if (error)
    go("/purchasing/control", "退货失败，请确认隔离库存和应付结算状态", true);
  revalidatePath("/purchasing/control");
  revalidatePath("/inventory/control");
  revalidatePath("/finance");
  go("/purchasing/control", "采购退货已完成");
}
export async function manageLocationAction(fd: FormData) {
  await requireCurrentEmployee();
  const p = z
    .object({
      warehouse: uuid,
      code: z.string().trim().min(1).max(30),
      name: z.string().trim().min(1).max(60),
      zone: z.string().trim().max(40),
      type: z.enum([
        "receiving",
        "storage",
        "picking",
        "quarantine",
        "shipping",
      ]),
    })
    .safeParse({
      warehouse: fd.get("warehouseId"),
      code: fd.get("code"),
      name: fd.get("name"),
      zone: fd.get("zone") ?? "",
      type: fd.get("locationType"),
    });
  if (!p.success) go("/inventory/control", "库位资料无效", true);
  const s = await createClient();
  const { error } = await s.rpc("manage_warehouse_location", {
    p_location_id: null,
    p_warehouse_id: p.data.warehouse,
    p_code: p.data.code,
    p_name: p.data.name,
    p_zone: p.data.zone,
    p_location_type: p.data.type,
    p_status: "active",
  });
  if (error) go("/inventory/control", "库位创建失败", true);
  revalidatePath("/inventory/control");
  go("/inventory/control", "库位已创建");
}
export async function moveBatchAction(fd: FormData) {
  await requireCurrentEmployee();
  const p = z
    .object({ batch: uuid, location: uuid })
    .safeParse({ batch: fd.get("batchId"), location: fd.get("locationId") });
  if (!p.success) go("/inventory/control", "批次或库位无效", true);
  const s = await createClient();
  const { error } = await s.rpc("move_inventory_batch_location", {
    p_batch_id: p.data.batch,
    p_location_id: p.data.location,
  });
  if (error) go("/inventory/control", "批次移位失败", true);
  revalidatePath("/inventory/control");
  go("/inventory/control", "批次库位已更新");
}
export async function saveInventoryPolicyAction(fd: FormData) {
  await requireCurrentEmployee();
  const p = z
    .object({
      days: z.coerce.number().int().min(1).max(730),
      strategy: z.enum(["fifo", "fefo"]),
    })
    .safeParse({ days: fd.get("days"), strategy: fd.get("strategy") });
  if (!p.success) go("/inventory/control", "库存策略无效", true);
  const s = await createClient();
  const { error } = await s.rpc("update_inventory_policy", {
    p_expiry_warning_days: p.data.days,
    p_issue_strategy: p.data.strategy,
  });
  if (error) go("/inventory/control", "库存策略保存失败", true);
  revalidatePath("/inventory/control");
  go("/inventory/control", "库存策略已保存");
}
export async function releaseCustomerAction(fd: FormData) {
  await requireCurrentEmployee();
  const p = z
    .object({ id: uuid, reason: z.string().trim().min(2).max(300) })
    .safeParse({ id: fd.get("customerId"), reason: fd.get("reason") });
  if (!p.success) go("/customers/operations", "客户或原因无效", true);
  const s = await createClient();
  const { error } = await s.rpc("move_customer_to_public_pool", {
    p_customer_id: p.data.id,
    p_reason: p.data.reason,
  });
  if (error) go("/customers/operations", "释放失败", true);
  revalidatePath("/customers/operations");
  go("/customers/operations", "客户已进入公海");
}
export async function claimCustomerAction(fd: FormData) {
  await requireCurrentEmployee();
  const id = uuid.safeParse(fd.get("customerId"));
  if (!id.success) go("/customers/operations", "客户无效", true);
  const s = await createClient();
  const { error } = await s.rpc("claim_customer_from_public_pool", {
    p_customer_id: id.data,
  });
  if (error) go("/customers/operations", "领取失败，客户可能已被领取", true);
  revalidatePath("/customers/operations");
  go("/customers/operations", "客户领取成功");
}
export async function updateCreditAction(fd: FormData) {
  await requireCurrentEmployee();
  const p = z
    .object({
      id: uuid,
      limit: z.coerce.number().nonnegative(),
      days: z.coerce.number().int().min(0).max(365),
      risk: z.enum(["low", "normal", "high", "blocked"]),
      status: z.enum(["active", "suspended"]),
      note: text,
    })
    .safeParse({
      id: fd.get("customerId"),
      limit: fd.get("creditLimit"),
      days: fd.get("termDays"),
      risk: fd.get("riskLevel"),
      status: fd.get("status"),
      note: fd.get("note") ?? "",
    });
  if (!p.success) go("/customers/operations", "信用资料无效", true);
  const s = await createClient();
  const { error } = await s.rpc("update_customer_credit", {
    p_customer_id: p.data.id,
    p_credit_limit: p.data.limit,
    p_payment_term_days: p.data.days,
    p_risk_level: p.data.risk,
    p_status: p.data.status,
    p_note: p.data.note,
  });
  if (error) go("/customers/operations", "信用资料保存失败", true);
  revalidatePath("/customers/operations");
  go("/customers/operations", "信用资料已更新");
}
export async function generateBusinessJournalAction(fd: FormData) {
  await requireCurrentEmployee();
  const id = uuid.safeParse(fd.get("documentId"));
  if (!id.success) go("/finance/automation", "业务单据无效", true);
  const s = await createClient();
  const { data, error } = await s.rpc("generate_business_journal_draft", {
    p_finance_document_id: id.data,
  });
  if (error)
    go("/finance/automation", "凭证生成失败，请检查规则、期间和权限", true);
  revalidatePath("/finance/automation");
  revalidatePath("/finance/accounting");
  go(
    "/finance/automation",
    `凭证 ${String((data as { entryNo?: string })?.entryNo ?? "")} 已生成`,
  );
}
