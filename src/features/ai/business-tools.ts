import "server-only";

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logServerEvent } from "@/lib/observability/server-log";
import type { BusinessToolName } from "@/features/ai/business-tool-planner";

const toolSchema = z.enum([
  "finance.receivables.summary",
  "inventory.availability",
  "sales.order.trace",
  "sales.order.draft.plan",
  "finance.journal.draft.plan",
]);

const inputSchemas = {
  "finance.receivables.summary": z.object({ customerId: z.uuid().optional() }).strict(),
  "inventory.availability": z.object({ keyword: z.string().trim().min(1).max(80) }).strict(),
  "sales.order.trace": z.object({ orderId: z.uuid() }).strict(),
  "sales.order.draft.plan": z.object({
    customerId: z.uuid(), warehouseId: z.uuid(),
    lines: z.array(z.object({ productId: z.uuid(), quantity: z.number().positive().max(1_000_000), unitPrice: z.number().nonnegative().max(1_000_000_000) })).min(1).max(100),
  }).strict(),
  "finance.journal.draft.plan": z.object({
    bookId: z.uuid(), entryDate: z.iso.date(), summary: z.string().trim().min(2).max(200),
    lines: z.array(z.object({ accountId: z.uuid(), summary: z.string().trim().min(1).max(200), debitAmount: z.number().nonnegative(), creditAmount: z.number().nonnegative() }).refine((line) => (line.debitAmount > 0) !== (line.creditAmount > 0))).min(2).max(100),
  }).strict(),
};

export type { BusinessToolName } from "@/features/ai/business-tool-planner";

export const businessToolCatalog = [
  { name: "finance.receivables.summary", description: "在当前权限范围汇总应收余额与逾期金额", mode: "read" },
  { name: "inventory.availability", description: "查询指定商品在当前权限范围内的可用库存", mode: "read" },
  { name: "sales.order.trace", description: "查询销售订单的审批、出库与应收链路", mode: "read" },
  { name: "sales.order.draft.plan", description: "生成销售订单草稿计划，须由用户在业务页面确认", mode: "plan" },
  { name: "finance.journal.draft.plan", description: "生成借贷平衡的凭证草稿计划，须由用户在核算页面确认", mode: "plan" },
] as const;

export function businessToolContext(tool: BusinessToolName, result: unknown) {
  return `【结构化业务工具：${tool}】\n${JSON.stringify(result).slice(0, 6000)}`;
}

function money(value: unknown) {
  return Number(value ?? 0).toFixed(2);
}

export async function executeBusinessTool(
  supabase: SupabaseClient,
  tool: unknown,
  input: unknown,
  employeeId: string,
) {
  const toolName = toolSchema.parse(tool);
  const startedAt = Date.now();
  let result: unknown;

  if (toolName === "finance.receivables.summary") {
    const parsed = inputSchemas[toolName].parse(input);
    let query = supabase
      .from("finance_documents")
      .select("id, customer_id, document_no, counterparty_name, due_date, total_amount, settled_amount, status")
      .eq("document_type", "receivable")
      .in("status", ["open", "partial"])
      .order("due_date")
      .limit(100);
    if (parsed.customerId) query = query.eq("customer_id", parsed.customerId);
    const { data, error } = await query;
    if (error) throw error;
    const now = new Date().toISOString().slice(0, 10);
    const rows = (data ?? []).map((row) => ({
      id: row.id,
      documentNo: row.document_no,
      counterparty: row.counterparty_name,
      dueDate: row.due_date,
      remaining: money(Number(row.total_amount) - Number(row.settled_amount)),
      overdue: row.due_date < now,
      href: `/finance/receivables/${row.customer_id ?? ""}`,
    }));
    result = {
      currency: "CNY",
      documentCount: rows.length,
      outstanding: money(rows.reduce((sum, row) => sum + Number(row.remaining), 0)),
      overdue: money(rows.filter((row) => row.overdue).reduce((sum, row) => sum + Number(row.remaining), 0)),
      documents: rows,
    };
  } else if (toolName === "inventory.availability") {
    const parsed = inputSchemas[toolName].parse(input);
    const safe = parsed.keyword.replace(/[,%()]/g, " ").trim();
    const { data, error } = await supabase
      .from("inventory_items")
      .select("id, sku, product_name, specification, barcode, available_quantity, quantity, reserved_quantity, unit, location_code")
      .eq("status", "active")
      .or(`sku.ilike.%${safe}%,product_name.ilike.%${safe}%,barcode.ilike.%${safe}%`)
      .order("available_quantity", { ascending: false })
      .limit(30);
    if (error) throw error;
    result = {
      items: (data ?? []).map((row) => ({
        id: row.id, sku: row.sku, name: row.product_name, specification: row.specification,
        availableQuantity: row.available_quantity, physicalQuantity: row.quantity,
        reservedQuantity: row.reserved_quantity, unit: row.unit, locationCode: row.location_code,
        href: "/inventory",
      })),
    };
  } else if (toolName === "sales.order.trace") {
    const parsed = inputSchemas[toolName].parse(input);
    const { data, error } = await supabase.rpc("sales_order_trace_v2", { p_order_id: parsed.orderId });
    if (error) throw error;
    if (!data) throw new Error("订单不存在或当前账号无权查看");
    result = { orderId: parsed.orderId, trace: data, href: `/sales/orders/${parsed.orderId}` };
  } else if (toolName === "sales.order.draft.plan") {
    const parsed = inputSchemas[toolName].parse(input);
    const total = parsed.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
    result = { status: "requires_user_confirmation", customerId: parsed.customerId, warehouseId: parsed.warehouseId, lineCount: parsed.lines.length, total: money(total), lines: parsed.lines, confirmationPath: "/sales" };
  } else {
    const parsed = inputSchemas[toolName].parse(input);
    const debit = parsed.lines.reduce((sum, line) => sum + line.debitAmount, 0);
    const credit = parsed.lines.reduce((sum, line) => sum + line.creditAmount, 0);
    result = { status: "requires_user_confirmation", bookId: parsed.bookId, entryDate: parsed.entryDate, summary: parsed.summary, debit: money(debit), credit: money(credit), balanced: Math.abs(debit - credit) < 0.001, lines: parsed.lines, confirmationPath: "/finance/accounting#new-entry" };
  }

  logServerEvent("ai_business_tool_completed", {
    tool: toolName, employeeId, durationMs: Date.now() - startedAt,
  });
  return { tool: toolName, result };
}
