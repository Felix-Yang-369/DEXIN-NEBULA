import ExcelJS from "@excel.js/exceljs";

export type CashDocumentExportRow = {
  document_no: string;
  document_type: "receipt" | "payment";
  document_date: string;
  counterparty_name: string;
  payment_channel: string;
  account_name: string | null;
  total_amount: number;
  allocated_amount: number;
  bank_reference: string | null;
  summary: string;
  status: string;
  reversal_status: string | null;
};

function safeText(value: string | null) {
  const text = value?.trim() || "";
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

export async function buildCashDocumentWorkbook(input: {
  rows: CashDocumentExportRow[];
  exportedBy: string;
  startDate: string;
  endDate: string;
}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "德馨星云 DEXIN NEBULA";
  workbook.company = "长沙德馨淼盛科技有限公司";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("收付款单台账", {
    views: [{ state: "frozen", ySplit: 3, showGridLines: false }],
  });
  sheet.columns = [
    { key: "no", width: 22 }, { key: "type", width: 11 },
    { key: "date", width: 14 }, { key: "counterparty", width: 28 },
    { key: "channel", width: 13 }, { key: "account", width: 20 },
    { key: "amount", width: 16 }, { key: "allocated", width: 16 },
    { key: "unapplied", width: 16 }, { key: "reference", width: 20 },
    { key: "summary", width: 32 }, { key: "status", width: 14 },
  ];
  sheet.mergeCells("A1:L1");
  sheet.getCell("A1").value = "收付款单台账";
  sheet.getCell("A1").font = { bold: true, size: 18, color: { argb: "FFFFFF" } };
  sheet.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "123B52" } };
  sheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(1).height = 36;
  sheet.mergeCells("A2:L2");
  sheet.getCell("A2").value = `期间：${input.startDate} 至 ${input.endDate}；导出人：${safeText(input.exportedBy)}`;
  sheet.getCell("A2").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "EAF4EF" } };
  const headers = ["单据编号", "类型", "日期", "往来单位", "方式", "资金账户", "总金额", "已核销", "预收/预付", "银行流水号", "摘要", "状态"];
  headers.forEach((header, index) => {
    const cell = sheet.getCell(3, index + 1);
    cell.value = header;
    cell.font = { bold: true, color: { argb: "FFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "087C78" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });
  input.rows.forEach((row) => {
    const status = row.reversal_status === "reversed"
      ? "已红冲"
      : row.reversal_status === "pending"
        ? "红冲待审批"
        : ({ draft: "草稿", submitted: "已提交", approved: "已批准", completed: "已完成", void: "已作废" }[row.status] ?? row.status);
    const worksheetRow = sheet.addRow({
      no: safeText(row.document_no), type: row.document_type === "receipt" ? "收款单" : "付款单",
      date: row.document_date, counterparty: safeText(row.counterparty_name),
      channel: ({ bank: "银行转账", wechat: "微信支付", alipay: "支付宝", cash: "现金", other: "其他" }[row.payment_channel] ?? row.payment_channel),
      account: safeText(row.account_name), amount: Number(row.total_amount),
      allocated: Number(row.allocated_amount), unapplied: Number(row.total_amount) - Number(row.allocated_amount),
      reference: safeText(row.bank_reference), summary: safeText(row.summary), status,
    });
    [7, 8, 9].forEach((column) => {
      worksheetRow.getCell(column).numFmt = '¥#,##0.00;[Red]-¥#,##0.00';
    });
  });
  sheet.autoFilter = {
    from: { row: 3, column: 1 },
    to: { row: 3, column: 12 },
  };
  return workbook.xlsx.writeBuffer();
}
