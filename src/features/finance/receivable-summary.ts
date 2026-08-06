export type ReceivableSummaryRow = {
  customer_key: string;
  customer_id: string | null;
  customer_no: string | null;
  customer_name: string;
  salesperson_no: string | null;
  salesperson_name: string | null;
  opening_balance: number;
  period_receivable: number;
  period_received: number;
  ending_balance: number;
  overdue_balance: number;
  document_count: number;
};

export type ReceivableSummaryTotals = {
  openingBalance: number;
  periodReceivable: number;
  periodReceived: number;
  endingBalance: number;
  overdueBalance: number;
  documentCount: number;
  collectionRate: number | null;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function dateText(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function currentMonthRange(now = new Date()) {
  const parts = dateText(now).split("-");
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();

  return {
    startDate: `${parts[0]}-${parts[1]}-01`,
    endDate: `${parts[0]}-${parts[1]}-${String(lastDay).padStart(2, "0")}`,
  };
}

function validDate(value: string | null | undefined) {
  return Boolean(value && ISO_DATE.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)));
}

export function resolveReceivableReportRange(
  startDate?: string | null,
  endDate?: string | null,
  now = new Date(),
) {
  const fallback = currentMonthRange(now);
  let start = validDate(startDate) ? String(startDate) : fallback.startDate;
  let end = validDate(endDate) ? String(endDate) : fallback.endDate;

  if (start > end) {
    [start, end] = [end, start];
  }

  return { startDate: start, endDate: end };
}

function numeric(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function normalizeReceivableSummaryRows(value: unknown): ReceivableSummaryRow[] {
  if (!Array.isArray(value)) return [];

  return value.map((item) => {
    const row = (item ?? {}) as Record<string, unknown>;
    return {
      customer_key: String(row.customer_key ?? ""),
      customer_id: row.customer_id ? String(row.customer_id) : null,
      customer_no: row.customer_no ? String(row.customer_no) : null,
      customer_name: String(row.customer_name ?? "未命名客户"),
      salesperson_no: row.salesperson_no ? String(row.salesperson_no) : null,
      salesperson_name: row.salesperson_name ? String(row.salesperson_name) : null,
      opening_balance: numeric(row.opening_balance),
      period_receivable: numeric(row.period_receivable),
      period_received: numeric(row.period_received),
      ending_balance: numeric(row.ending_balance),
      overdue_balance: numeric(row.overdue_balance),
      document_count: numeric(row.document_count),
    };
  });
}

export function receivableCollectionRate(
  openingBalance: number,
  periodReceivable: number,
  periodReceived: number,
) {
  const collectible = openingBalance + periodReceivable;
  if (collectible <= 0) return null;
  return Math.max(0, periodReceived / collectible);
}

export function summarizeReceivableRows(
  rows: ReceivableSummaryRow[],
): ReceivableSummaryTotals {
  const totals = rows.reduce(
    (result, row) => ({
      openingBalance: result.openingBalance + row.opening_balance,
      periodReceivable: result.periodReceivable + row.period_receivable,
      periodReceived: result.periodReceived + row.period_received,
      endingBalance: result.endingBalance + row.ending_balance,
      overdueBalance: result.overdueBalance + row.overdue_balance,
      documentCount: result.documentCount + row.document_count,
    }),
    {
      openingBalance: 0,
      periodReceivable: 0,
      periodReceived: 0,
      endingBalance: 0,
      overdueBalance: 0,
      documentCount: 0,
    },
  );

  return {
    ...totals,
    collectionRate: receivableCollectionRate(
      totals.openingBalance,
      totals.periodReceivable,
      totals.periodReceived,
    ),
  };
}

export function receivableReportQuery(params: {
  startDate: string;
  endDate: string;
  search?: string | null;
  includeZero?: boolean;
}) {
  return {
    p_start_date: params.startDate,
    p_end_date: params.endDate,
    p_search: params.search?.trim() || null,
    p_include_zero: Boolean(params.includeZero),
  };
}
