import ExcelJS from "@excel.js/exceljs";
import { getProductQualityFlags } from "./quality";

export type ProductExportRow = {
  id: string;
  code: string;
  image_path: string | null;
  barcode: string | null;
  category: "rice" | "oil" | "gift";
  source_category: string;
  brand: string | null;
  short_name: string;
  name: string;
  name_en: string | null;
  specification: string | null;
  case_specification: string | null;
  shelf_life: string | null;
  tax_rate: number | null;
  minimum_order: string | null;
  stock_status: string | null;
  supports_dropship: boolean;
  is_recommended: boolean;
  applicable_scenarios: string | null;
  description: string | null;
  delivery_notes: string | null;
  invoice_notes: string | null;
  alternative_product_codes: string[];
  keywords: string[];
  customer_query_reply: string | null;
  out_of_stock_reply: string | null;
  order_guide_reply: string | null;
};

export type ProductExportPrice = {
  product_id: string;
  price_type: "procurement" | "retail" | "group" | "dropship";
  amount_cny: number;
};

const headers = [
  "德馨产品编号",
  "产品矢量图",
  "国际条形码",
  "类别",
  "品牌",
  "产品简称",
  "标准产品名称",
  "产品名称英文",
  "规格",
  "箱规",
  "保质期",
  "税率",
  "含税集采自提价",
  "建议零售价",
  "团购价",
  "一件代发价（国内一区）",
  "起订量",
  "库存状态",
  "是否支持一件代发",
  "是否推荐",
  "适用场景",
  "产品介绍",
  "配送说明",
  "开票说明",
  "替代推荐产品编号",
  "关键词",
  "客户查询回复话术",
  "缺货回复话术",
  "下单引导话术",
] as const;

const widths = [
  18, 12, 18, 12, 14, 18, 32, 28, 14, 14, 12, 10, 16, 16, 14, 20, 12,
  14, 16, 10, 26, 38, 30, 24, 22, 26, 45, 45, 45,
];

function buildPriceMap(prices: ProductExportPrice[]) {
  const result = new Map<string, Map<ProductExportPrice["price_type"], number>>();
  for (const price of prices) {
    const item =
      result.get(price.product_id) ??
      new Map<ProductExportPrice["price_type"], number>();
    item.set(price.price_type, Number(price.amount_cny));
    result.set(price.product_id, item);
  }
  return result;
}

export async function buildProductMasterWorkbook({
  products,
  prices,
  employeeName,
  exportedAt,
}: {
  products: ProductExportRow[];
  prices: ProductExportPrice[];
  employeeName: string;
  exportedAt: Date;
}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "德馨星云 DEXIN Nebula";
  workbook.created = exportedAt;
  workbook.modified = exportedAt;

  const sheet = workbook.addWorksheet("产品知识库总表", {
    properties: { defaultRowHeight: 20 },
    views: [{ state: "frozen", ySplit: 2, showGridLines: false }],
  });
  const columnKeys = headers.map((_, index) => `column${index + 1}`);
  sheet.columns = widths.map((width, index) => ({
    key: columnKeys[index],
    width,
  }));

  sheet.mergeCells("A1:AC1");
  const title = sheet.getCell("A1");
  title.value = `德馨产品库总表｜导出人：${employeeName}｜${new Intl.DateTimeFormat(
    "zh-CN",
    {
      timeZone: "Asia/Shanghai",
      dateStyle: "medium",
      timeStyle: "short",
    },
  ).format(exportedAt)}`;
  title.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 13 };
  title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF064E45" } };
  title.alignment = { vertical: "middle", horizontal: "left" };
  sheet.getRow(1).height = 32;

  const headerRow = sheet.getRow(2);
  headerRow.height = 34;
  headers.forEach((header, index) => {
    headerRow.getCell(index + 1).value = header;
  });
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1677C8" },
    };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = {
      bottom: { style: "hair", color: { argb: "FFD7E5EE" } },
    };
  });

  const priceMap = buildPriceMap(prices);
  products.forEach((product, index) => {
    const productPrices = priceMap.get(product.id);
    const values = [
      product.code,
      product.image_path ? "已上传" : "待补充",
      product.barcode,
      product.source_category || product.category,
      product.brand,
      product.short_name,
      product.name,
      product.name_en,
      product.specification,
      product.case_specification,
      product.shelf_life,
      product.tax_rate,
      productPrices?.get("procurement"),
      productPrices?.get("retail"),
      productPrices?.get("group"),
      productPrices?.get("dropship"),
      product.minimum_order,
      product.stock_status,
      product.supports_dropship ? "是" : "否",
      product.is_recommended ? "是" : "否",
      product.applicable_scenarios,
      product.description,
      product.delivery_notes,
      product.invoice_notes,
      product.alternative_product_codes.join("、") || null,
      product.keywords.join("、") || null,
      product.customer_query_reply,
      product.out_of_stock_reply,
      product.order_guide_reply,
    ];
    const row = sheet.addRow(
      Object.fromEntries(
        columnKeys.map((key, columnIndex) => [key, values[columnIndex]]),
      ),
    );
    row.height = 42;
    for (let columnNumber = 1; columnNumber <= headers.length; columnNumber += 1) {
      const cell = row.getCell(columnNumber);
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: index % 2 ? "FFF3F8FC" : "FFFFFFFF" },
      };
      cell.alignment = {
        vertical: "middle",
        horizontal: columnNumber >= 12 && columnNumber <= 20 ? "center" : "left",
      };
      cell.font = { size: 9, color: { argb: "FF263B45" } };
      cell.border = {
        bottom: { style: "hair", color: { argb: "FFDCE7EC" } },
      };
      if (columnNumber === 12) cell.numFmt = "0.00%";
      if (columnNumber >= 13 && columnNumber <= 16) {
        cell.numFmt = '¥#,##0.00';
      }
      if (columnNumber === 1 || columnNumber === 3) cell.numFmt = "@";
    }
  });

  sheet.autoFilter = {
    from: { row: 2, column: 1 },
    to: { row: Math.max(2, products.length + 2), column: headers.length },
  };
  const qualitySheet = workbook.addWorksheet("数据质量检查", {
    properties: { defaultRowHeight: 22 },
    views: [{ state: "frozen", ySplit: 1, showGridLines: false }],
  });
  qualitySheet.columns = [
    { key: "code", width: 20 },
    { key: "name", width: 42 },
    { key: "issue", width: 20 },
    { key: "action", width: 48 },
  ];
  qualitySheet.addRow({
    code: "德馨产品编号",
    name: "标准产品名称",
    issue: "问题类型",
    action: "处理建议",
  });
  const qualityHeader = qualitySheet.getRow(1);
  qualityHeader.height = 30;
  qualityHeader.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF064E45" },
    };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });

  const flagLabels = {
    missing_image: ["缺少产品图", "上传透明背景 PNG、JPG 或 WebP 产品图"],
    missing_barcode: ["条码待确认", "向供应商确认国际条形码"],
    missing_price: ["缺少价格", "至少维护一种当前岗位可见的有效价格"],
    incomplete_reply: ["标准话术不完整", "补齐查询、缺货及下单引导话术"],
  } as const;
  products.forEach((product) => {
    const flags = getProductQualityFlags(
      product,
      (priceMap.get(product.id)?.size ?? 0) > 0,
    );
    flags.forEach((flag) => {
      qualitySheet.addRow({
        code: product.code,
        name: product.name,
        issue: flagLabels[flag][0],
        action: flagLabels[flag][1],
      });
    });
  });
  qualitySheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    row.height = 26;
    row.eachCell((cell) => {
      cell.alignment = { vertical: "middle" };
      cell.font = { size: 10, color: { argb: "FF344B43" } };
      cell.border = {
        bottom: { style: "hair", color: { argb: "FFDCE7E1" } },
      };
    });
    row.getCell(1).numFmt = "@";
  });
  qualitySheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(1, qualitySheet.rowCount), column: 4 },
  };

  return workbook.xlsx.writeBuffer();
}
