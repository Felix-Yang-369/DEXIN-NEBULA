import { getCurrentEmployee } from "@/features/auth/current-employee";
import {
  normalizeReceivableSummaryRows,
  receivableReportQuery,
  resolveReceivableReportRange,
  summarizeReceivableRows,
} from "@/features/finance/receivable-summary";
import { buildReceivableSummaryWorkbook } from "@/features/finance/receivable-summary-workbook";
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
      if (part.type !== "literal") result[part.type] = part.value;
      return result;
    }, {});

  return `${parts.year}${parts.month}${parts.day}-${parts.hour}${parts.minute}`;
}

function safeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "_").slice(0, 32);
}

export async function GET(request: Request) {
  const employee = await getCurrentEmployee();
  if (!employee) {
    return Response.redirect(
      new URL("/login?next=%2Ffinance%2Freceivables", request.url),
      307,
    );
  }

  if (
    !employee.roleCodes.includes("finance") &&
    !employee.roleCodes.includes("chairman")
  ) {
    return Response.json({ error: "无权导出财务报表" }, { status: 403 });
  }

  const url = new URL(request.url);
  const { startDate, endDate } = resolveReceivableReportRange(
    url.searchParams.get("startDate"),
    url.searchParams.get("endDate"),
  );
  const search = url.searchParams.get("search")?.trim() ?? "";
  const includeZero = url.searchParams.get("includeZero") === "1";
  const supabase = await createClient();
  const result = await supabase.rpc(
    "finance_receivable_summary",
    receivableReportQuery({ startDate, endDate, search, includeZero }),
  );

  if (result.error) {
    console.error("finance receivable export query failed", result.error.code);
    return Response.json(
      { error: "应收汇总数据读取失败，请稍后重试" },
      { status: 500 },
    );
  }

  const rows = normalizeReceivableSummaryRows(result.data);
  const totals = summarizeReceivableRows(rows);
  const exportedAt = new Date();
  const buffer = await buildReceivableSummaryWorkbook({
    rows,
    totals,
    startDate,
    endDate,
    search,
    includeZero,
    exportedBy: employee.name,
  });

  const { error: auditError } = await supabase.rpc(
    "record_finance_report_export",
    {
      p_report_code: "receivable_summary",
      p_start_date: startDate,
      p_end_date: endDate,
      p_row_count: rows.length,
    },
  );
  if (auditError) {
    console.error("finance report export audit failed", auditError.code);
  }

  const timestamp = shanghaiTimestamp(exportedAt);
  const chineseFileName = `应收账款汇总表-${timestamp}-${safeFileName(employee.name)}.xlsx`;
  const asciiFileName = `receivable-summary-${timestamp}.xlsx`;

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
