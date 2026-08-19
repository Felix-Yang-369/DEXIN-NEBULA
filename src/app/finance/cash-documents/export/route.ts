import { getCurrentEmployee } from "@/features/auth/current-employee";
import {
  buildCashDocumentWorkbook,
  type CashDocumentExportRow,
} from "@/features/finance/cash-document-workbook";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isoDate(value: string | null, fallback: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value ?? "") ? value! : fallback;
}

export async function GET(request: Request) {
  const employee = await getCurrentEmployee();
  if (!employee) {
    return Response.redirect(new URL("/login?next=%2Ffinance%2Fcash-documents", request.url), 307);
  }
  if (!employee.roleCodes.some((role) => role === "finance" || role === "chairman")) {
    return Response.json({ error: "无权导出收付款单" }, { status: 403 });
  }
  const url = new URL(request.url);
  const now = new Date();
  const defaultEnd = now.toISOString().slice(0, 10);
  const defaultStart = `${now.getUTCFullYear()}-01-01`;
  const startDate = isoDate(url.searchParams.get("startDate"), defaultStart);
  const endDate = isoDate(url.searchParams.get("endDate"), defaultEnd);
  if (startDate > endDate) return Response.json({ error: "导出日期范围无效" }, { status: 400 });

  const supabase = await createClient();
  const result = await supabase
    .from("finance_cash_documents")
    .select("document_no, document_type, document_date, counterparty_name, payment_channel, account_name, total_amount, allocated_amount, bank_reference, summary, status, reversal_status")
    .gte("document_date", startDate)
    .lte("document_date", endDate)
    .order("document_date", { ascending: false })
    .limit(5000);
  if (result.error) {
    console.error("cash document export failed", result.error.code);
    return Response.json({ error: "收付款单导出失败，请稍后重试" }, { status: 500 });
  }
  const rows = (result.data ?? []) as CashDocumentExportRow[];
  const buffer = await buildCashDocumentWorkbook({ rows, exportedBy: employee.name, startDate, endDate });
  const { error: auditError } = await supabase.rpc("record_finance_report_export", {
    p_report_code: "cash_documents", p_start_date: startDate, p_end_date: endDate, p_row_count: rows.length,
  });
  if (auditError) console.error("cash document export audit failed", auditError.code);
  const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 12);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Disposition": `attachment; filename="cash-documents-${stamp}.xlsx"; filename*=UTF-8''${encodeURIComponent(`收付款单台账-${stamp}.xlsx`)}`,
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
