import ExcelJS from "@excel.js/exceljs";
import type {
  ReceivableSummaryRow,
  ReceivableSummaryTotals,
} from "./receivable-summary";

const COLOR = {
  dark: "173F38",
  green: "1C6758",
  pale: "EAF4EF",
  gold: "C7A45A",
  gray: "F3F5F4",
  line: "B7C3BF",
  danger: "C8515B",
  white: "FFFFFF",
};

function safeText(value: string | null) {
  const text = value?.trim() || "";
  if (!text) return null;
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function money(value: number) {
  return Math.round(value * 100) / 100;
}

export async function buildReceivableSummaryWorkbook(input: {
  rows: ReceivableSummaryRow[];
  totals: ReceivableSummaryTotals;
  startDate: string;
  endDate: string;
  search?: string | null;
  includeZero: boolean;
  exportedBy: string;
}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "德馨星云 DEXIN NEBULA";
  workbook.company = "长沙德馨淼盛科技有限公司";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("应收账款汇总表", {
    views: [{ state: "frozen", ySplit: 4, showGridLines: false }],
    properties: { defaultRowHeight: 22 },
  });

  sheet.columns = [
    { key: "customerNo", width: 18 },
    { key: "customerName", width: 30 },
    { key: "salespersonNo", width: 17 },
    { key: "salespersonName", width: 16 },
    { key: "opening", width: 18 },
    { key: "receivable", width: 18 },
    { key: "received", width: 18 },
    { key: "ending", width: 18 },
    { key: "overdue", width: 18 },
    { key: "rate", width: 14 },
    { key: "documents", width: 12 },
  ];

  sheet.mergeCells("A1:K1");
  const title = sheet.getCell("A1");
  title.value = "应收账款汇总表";
  title.font = { bold: true, size: 18, color: { argb: COLOR.white } };
  title.alignment = { horizontal: "center", vertical: "middle" };
  title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR.dark } };
  sheet.getRow(1).height = 36;

  sheet.mergeCells("A2:K2");
  const description = sheet.getCell("A2");
  const searchLabel = input.search?.trim() ? `；查询：${safeText(input.search)}` : "";
  description.value =
    `期间：${input.startDate} 至 ${input.endDate}；零余额：${input.includeZero ? "显示" : "隐藏"}` +
    `${searchLabel}；导出人：${safeText(input.exportedBy)}`;
  description.font = { size: 10, color: { argb: "4B5B56" } };
  description.alignment = { horizontal: "left", vertical: "middle" };
  description.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR.pale } };
  sheet.getRow(2).height = 28;

  sheet.mergeCells("A3:D3");
  sheet.mergeCells("F3:G3");
  sheet.mergeCells("H3:K3");
  sheet.getCell("A3").value = "客户与业务员";
  sheet.getCell("E3").value = "期初";
  sheet.getCell("F3").value = "本期发生";
  sheet.getCell("H3").value = "期末与风险";

  const headers = [
    "客户编码",
    "客户名称",
    "默认业务员编码",
    "默认业务员",
    "期初余额",
    "本期应收",
    "本期已收",
    "期末余额",
    "逾期余额",
    "期间收款率",
    "单据数",
  ];
  headers.forEach((header, index) => {
    sheet.getCell(4, index + 1).value = header;
  });

  for (const rowNo of [3, 4]) {
    const row = sheet.getRow(rowNo);
    row.height = 27;
    row.eachCell((cell) => {
      cell.font = { bold: true, size: 10, color: { argb: COLOR.white } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: rowNo === 3 ? COLOR.dark : COLOR.green },
      };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        top: { style: "hair", color: { argb: COLOR.line } },
        left: { style: "hair", color: { argb: COLOR.line } },
        bottom: { style: "hair", color: { argb: COLOR.line } },
        right: { style: "hair", color: { argb: COLOR.line } },
      };
    });
  }

  input.rows.forEach((row) => {
    const collectible = row.opening_balance + row.period_receivable;
    const excelRow = sheet.addRow({
      customerNo: safeText(row.customer_no),
      customerName: safeText(row.customer_name),
      salespersonNo: safeText(row.salesperson_no),
      salespersonName: safeText(row.salesperson_name),
      opening: money(row.opening_balance),
      receivable: money(row.period_receivable),
      received: money(row.period_received),
      ending: money(row.ending_balance),
      overdue: money(row.overdue_balance),
      rate: collectible > 0 ? row.period_received / collectible : null,
      documents: row.document_count,
    });
    excelRow.alignment = { vertical: "middle" };
    excelRow.eachCell((cell) => {
      cell.border = {
        top: { style: "hair", color: { argb: COLOR.line } },
        left: { style: "hair", color: { argb: COLOR.line } },
        bottom: { style: "hair", color: { argb: COLOR.line } },
        right: { style: "hair", color: { argb: COLOR.line } },
      };
    });
    for (let column = 5; column <= 9; column += 1) {
      excelRow.getCell(column).numFmt = '#,##0.00;[Red]-#,##0.00';
    }
    excelRow.getCell(10).numFmt = "0.00%";
    if (row.overdue_balance > 0) {
      excelRow.getCell(9).font = { color: { argb: COLOR.danger }, bold: true };
    }
  });

  const totalRowNo = 5 + input.rows.length;
  const totalRow = sheet.getRow(totalRowNo);
  [
    "合计",
    "",
    "",
    "",
    money(input.totals.openingBalance),
    money(input.totals.periodReceivable),
    money(input.totals.periodReceived),
    money(input.totals.endingBalance),
    money(input.totals.overdueBalance),
    input.totals.collectionRate,
    input.totals.documentCount,
  ].forEach((value, index) => {
    totalRow.getCell(index + 1).value = value;
  });
  sheet.mergeCells(`A${totalRowNo}:D${totalRowNo}`);
  totalRow.height = 28;
  totalRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: COLOR.dark } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "F7EDD7" } };
    cell.border = {
      top: { style: "medium", color: { argb: COLOR.gold } },
      bottom: { style: "hair", color: { argb: COLOR.gold } },
    };
  });
  for (let column = 5; column <= 9; column += 1) {
    totalRow.getCell(column).numFmt = '#,##0.00;[Red]-#,##0.00';
  }
  totalRow.getCell(10).numFmt = "0.00%";

  const noteRowNo = totalRowNo + 2;
  sheet.mergeCells(`A${noteRowNo}:K${noteRowNo}`);
  const note = sheet.getCell(`A${noteRowNo}`);
  note.value =
    "口径说明：期初余额=开始日期前已开应收－开始日期前已核销；本期应收按开单日期统计；本期已收按核销日期统计；逾期余额按截止日及到期日判断。";
  note.font = { size: 9, color: { argb: "6B7773" } };
  note.alignment = { vertical: "middle" };
  sheet.getRow(noteRowNo).height = 32;

  sheet.autoFilter = {
    from: { row: 4, column: 1 },
    to: { row: Math.max(4, totalRowNo - 1), column: 11 },
  };

  return workbook.xlsx.writeBuffer();
}
