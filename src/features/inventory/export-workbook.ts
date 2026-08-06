import ExcelJS from "@excel.js/exceljs";

export type InventoryExportWarehouse = {
  code: string;
  name: string;
  warehouse_type: "owned" | "third_party" | "virtual";
  partner_name: string | null;
};

export type InventoryExportItem = {
  id: string;
  product_id: string | null;
  sku: string;
  product_name: string;
  specification: string | null;
  category: "rice" | "oil" | "gift" | "other" | "unknown";
  barcode: string | null;
  case_specification: string | null;
  unit: string;
  location_code: string | null;
  quantity: number;
  available_quantity: number;
  reserved_quantity: number;
  quarantined_quantity: number;
  safety_stock: number;
  warehouses:
    | InventoryExportWarehouse
    | InventoryExportWarehouse[]
    | null;
};

export type InventoryExportBatch = {
  id: string;
  source_row_no: number | null;
  production_date: string | null;
  shelf_life_months: number | null;
  expiry_date: string | null;
  quantity: number;
  reserved_quantity: number;
  status: "available" | "quarantined" | "depleted";
  note: string | null;
  inventory_items:
    | {
        sku: string;
        product_name: string;
        specification: string | null;
        category: InventoryExportItem["category"];
        barcode: string | null;
        case_specification: string | null;
        unit: string;
      }
    | {
        sku: string;
        product_name: string;
        specification: string | null;
        category: InventoryExportItem["category"];
        barcode: string | null;
        case_specification: string | null;
        unit: string;
      }[]
    | null;
  warehouses: { name: string } | { name: string }[] | null;
};

export type InventoryExportMovement = {
  id: string;
  movement_no: string;
  movement_type:
    | "inbound"
    | "outbound"
    | "opening_balance"
    | "adjustment_in"
    | "adjustment_out";
  quantity: number;
  before_quantity: number;
  after_quantity: number;
  reference_no: string | null;
  note: string | null;
  created_at: string;
  inventory_items:
    | {
        sku: string;
        product_name: string;
        unit: string;
      }
    | {
        sku: string;
        product_name: string;
        unit: string;
      }[]
    | null;
  warehouses: { name: string } | { name: string }[] | null;
};

type BuildInventoryWorkbookInput = {
  employeeName: string;
  exportedAt: Date;
  inventory: InventoryExportItem[];
  batches: InventoryExportBatch[];
  movements: InventoryExportMovement[];
};

const COLORS = {
  primary: "173D3A",
  primarySoft: "EAF4EF",
  gold: "C9A35A",
  border: "DCE5E1",
  text: "22302D",
  muted: "66736F",
  warning: "FFF4E7",
  warningText: "9A6321",
  danger: "FFF0EB",
  dangerText: "A55B45",
  white: "FFFFFF",
};

function relatedOne<T>(value: T | T[] | null) {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function safeText(value: string | null | undefined) {
  const text = value?.trim() ?? "";
  if (!text) {
    return null;
  }
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function categoryLabel(category: InventoryExportItem["category"]) {
  return {
    rice: "大米",
    oil: "食用油",
    gift: "礼盒",
    other: "调味杂粮",
    unknown: "未分类",
  }[category];
}

function warehouseTypeLabel(
  warehouseType: InventoryExportWarehouse["warehouse_type"],
) {
  return {
    owned: "自有仓",
    third_party: "第三方仓",
    virtual: "虚拟仓",
  }[warehouseType];
}

function movementLabel(type: InventoryExportMovement["movement_type"]) {
  return {
    inbound: "入库",
    outbound: "出库",
    opening_balance: "期初导入",
    adjustment_in: "盘盈",
    adjustment_out: "盘亏",
  }[type];
}

function dateValue(value: string | null) {
  return value ? new Date(`${value}T00:00:00Z`) : null;
}

function compactDate(value: string | null) {
  return value?.replaceAll("-", "") ?? null;
}

function shanghaiExcelDateTime(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  })
    .formatToParts(value)
    .reduce<Record<string, string>>((result, part) => {
      if (part.type !== "literal") {
        result[part.type] = part.value;
      }
      return result;
    }, {});

  return new Date(
    Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
    ),
  );
}

function inventoryStatus(item: InventoryExportItem) {
  if (Number(item.quarantined_quantity) > 0) {
    return "存在隔离库存";
  }
  if (Number(item.quantity) === 0) {
    return "零库存";
  }
  if (
    Number(item.safety_stock) > 0 &&
    Number(item.available_quantity) <= Number(item.safety_stock)
  ) {
    return "低库存";
  }
  return "可正常出库";
}

function expiryStatus(batch: InventoryExportBatch, exportedAt: Date) {
  if (batch.status === "quarantined") {
    return "已到期隔离";
  }
  if (batch.status === "depleted" || Number(batch.quantity) === 0) {
    return "零库存";
  }
  if (!batch.expiry_date) {
    return "效期待补充";
  }

  const expiry = dateValue(batch.expiry_date);
  const ninetyDaysLater = new Date(exportedAt);
  ninetyDaysLater.setDate(ninetyDaysLater.getDate() + 90);
  return expiry && expiry <= ninetyDaysLater ? "90天内到期" : "效期正常";
}

export async function buildInventoryWorkbook({
  employeeName,
  exportedAt,
  inventory,
  batches,
  movements,
}: BuildInventoryWorkbookInput) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "德馨星云 DEXIN Nebula";
  workbook.lastModifiedBy = employeeName;
  workbook.created = exportedAt;
  workbook.modified = exportedAt;
  workbook.company = "长沙德馨淼盛科技有限公司";
  workbook.subject = "仓储库存、批次效期和出入库流水";
  workbook.title = "德馨星云仓储库存导出";

  const summarySheet = workbook.addWorksheet("导出说明", {
    properties: { defaultRowHeight: 22 },
    views: [{ showGridLines: false }],
  });
  summarySheet.columns = [
    { width: 22 },
    { width: 18 },
    { width: 4 },
    { width: 24 },
    { width: 20 },
    { width: 22 },
  ];
  summarySheet.mergeCells("A1:F2");
  summarySheet.getCell("A1").value = "德馨星云 · 仓储库存数据导出";
  summarySheet.getCell("A1").font = {
    name: "PingFang SC",
    size: 20,
    bold: true,
    color: { argb: COLORS.white },
  };
  summarySheet.getCell("A1").alignment = {
    vertical: "middle",
    horizontal: "left",
  };
  summarySheet.getCell("A1").fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: COLORS.primary },
  };
  summarySheet.getRow(1).height = 30;
  summarySheet.getRow(2).height = 30;

  summarySheet.getCell("A4").value = "导出信息";
  summarySheet.getCell("A4").font = {
    bold: true,
    color: { argb: COLORS.primary },
  };
  summarySheet.getCell("A5").value = "导出人";
  summarySheet.getCell("B5").value = safeText(employeeName);
  summarySheet.getCell("A6").value = "导出时间";
  summarySheet.getCell("B6").value = shanghaiExcelDateTime(exportedAt);
  summarySheet.getCell("B6").numFmt = "yyyy-mm-dd hh:mm";
  summarySheet.getCell("A7").value = "数据范围";
  summarySheet.getCell("B7").value = "当前账号权限内的德馨淼盛仓储数据";

  const physicalQuantity = inventory.reduce(
    (total, item) => total + Number(item.quantity),
    0,
  );
  const availableQuantity = inventory.reduce(
    (total, item) => total + Number(item.available_quantity),
    0,
  );
  const quarantinedQuantity = inventory.reduce(
    (total, item) => total + Number(item.quarantined_quantity),
    0,
  );
  const summaryCards = [
    ["库存 SKU", inventory.length],
    ["物理库存", physicalQuantity],
    ["可用库存", availableQuantity],
    ["隔离库存", quarantinedQuantity],
    ["库存批次", batches.length],
    ["可见流水", movements.length],
  ];
  summarySheet.getCell("A9").value = "导出摘要";
  summarySheet.getCell("A9").font = {
    bold: true,
    color: { argb: COLORS.primary },
  };
  summaryCards.forEach(([label, value], index) => {
    const column = (index % 3) * 2 + 1;
    const row = 10 + Math.floor(index / 3) * 3;
    const labelCell = summarySheet.getCell(row, column);
    const valueCell = summarySheet.getCell(row + 1, column);
    labelCell.value = label;
    labelCell.font = { size: 10, color: { argb: COLORS.muted } };
    valueCell.value = value;
    valueCell.numFmt = "#,##0";
    valueCell.font = {
      size: 16,
      bold: true,
      color: { argb: COLORS.primary },
    };
    summarySheet.mergeCells(row, column, row, column + 1);
    summarySheet.mergeCells(row + 1, column, row + 1, column + 1);
    for (let cardRow = row; cardRow <= row + 1; cardRow += 1) {
      for (let cardColumn = column; cardColumn <= column + 1; cardColumn += 1) {
        const cell = summarySheet.getCell(cardRow, cardColumn);
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: COLORS.primarySoft },
        };
      }
    }
  });

  summarySheet.getCell("A17").value = "口径说明";
  summarySheet.getCell("A17").font = {
    bold: true,
    color: { argb: COLORS.primary },
  };
  [
    "物理库存：仓库实际持有的全部库存，包含可用、预留及隔离数量。",
    "可用库存：通过效期校验且未预留、可正常办理出库的数量。",
    "隔离库存：已过期或处于质量隔离状态，不允许直接出库。",
    "批次出库：系统按照到期日优先顺序执行先到期先出。",
    "出入库流水仅导出当前账号有权查看的数据。",
  ].forEach((note, index) => {
    summarySheet.mergeCells(18 + index, 1, 18 + index, 6);
    summarySheet.getCell(18 + index, 1).value = note;
    summarySheet.getCell(18 + index, 1).font = {
      size: 10,
      color: { argb: COLORS.muted },
    };
  });

  const stockSheet = workbook.addWorksheet("库存总览", {
    properties: { defaultRowHeight: 21 },
    views: [{ state: "frozen", ySplit: 1, showGridLines: false }],
  });
  stockSheet.columns = [
    { header: "仓库", key: "warehouse", width: 24 },
    { header: "仓库类型", key: "warehouseType", width: 12 },
    { header: "服务方", key: "partner", width: 16 },
    { header: "SKU", key: "sku", width: 18 },
    { header: "商品名称", key: "productName", width: 32 },
    { header: "分类", key: "category", width: 12 },
    { header: "规格", key: "specification", width: 14 },
    { header: "箱规", key: "caseSpecification", width: 18 },
    { header: "69条码", key: "barcode", width: 18 },
    { header: "物理库存", key: "quantity", width: 13 },
    { header: "可用库存", key: "available", width: 13 },
    { header: "预留库存", key: "reserved", width: 13 },
    { header: "隔离库存", key: "quarantined", width: 13 },
    { header: "单位", key: "unit", width: 9 },
    { header: "库位", key: "location", width: 13 },
    { header: "安全库存", key: "safetyStock", width: 13 },
    { header: "库存状态", key: "status", width: 16 },
    { header: "产品主档", key: "productLink", width: 14 },
  ];

  for (const item of inventory) {
    const warehouse = relatedOne(item.warehouses);
    stockSheet.addRow({
      warehouse: safeText(warehouse?.name),
      warehouseType: warehouse
        ? warehouseTypeLabel(warehouse.warehouse_type)
        : "",
      partner: safeText(warehouse?.partner_name),
      sku: safeText(item.sku),
      productName: safeText(item.product_name),
      category: categoryLabel(item.category),
      specification: safeText(item.specification),
      caseSpecification: safeText(item.case_specification),
      barcode: safeText(item.barcode),
      quantity: Number(item.quantity),
      available: Number(item.available_quantity),
      reserved: Number(item.reserved_quantity),
      quarantined: Number(item.quarantined_quantity),
      unit: safeText(item.unit),
      location: safeText(item.location_code),
      safetyStock: Number(item.safety_stock),
      status: inventoryStatus(item),
      productLink: item.product_id ? "已关联" : "待关联",
    });
  }

  const batchSheet = workbook.addWorksheet("批次效期", {
    properties: { defaultRowHeight: 21 },
    views: [{ state: "frozen", ySplit: 1, showGridLines: false }],
  });
  batchSheet.columns = [
    { header: "仓库", key: "warehouse", width: 24 },
    { header: "SKU", key: "sku", width: 18 },
    { header: "商品名称", key: "productName", width: 32 },
    { header: "规格", key: "specification", width: 14 },
    { header: "生产日期", key: "productionDate", width: 14 },
    { header: "保质期（月）", key: "shelfLife", width: 14 },
    { header: "到期日期", key: "expiryDate", width: 14 },
    { header: "批次数量", key: "quantity", width: 13 },
    { header: "预留数量", key: "reserved", width: 13 },
    { header: "可用数量", key: "available", width: 13 },
    { header: "单位", key: "unit", width: 9 },
    { header: "效期状态", key: "expiryStatus", width: 16 },
    { header: "源表行", key: "sourceRow", width: 11 },
    { header: "备注", key: "note", width: 28 },
  ];

  for (const batch of batches) {
    const item = relatedOne(batch.inventory_items);
    const warehouse = relatedOne(batch.warehouses);
    batchSheet.addRow({
      warehouse: safeText(warehouse?.name),
      sku: safeText(item?.sku),
      productName: safeText(item?.product_name),
      specification: safeText(item?.specification),
      productionDate: dateValue(batch.production_date),
      shelfLife: batch.shelf_life_months,
      expiryDate: dateValue(batch.expiry_date),
      quantity: Number(batch.quantity),
      reserved: Number(batch.reserved_quantity),
      available:
        batch.status === "available"
          ? Number(batch.quantity) - Number(batch.reserved_quantity)
          : 0,
      unit: safeText(item?.unit),
      expiryStatus: expiryStatus(batch, exportedAt),
      sourceRow: batch.source_row_no,
      note: safeText(batch.note),
    });
  }

  const movementSheet = workbook.addWorksheet("出入库流水", {
    properties: { defaultRowHeight: 21 },
    views: [{ state: "frozen", ySplit: 1, showGridLines: false }],
  });
  movementSheet.columns = [
    { header: "流水号", key: "movementNo", width: 22 },
    { header: "业务类型", key: "type", width: 12 },
    { header: "发生时间", key: "createdAt", width: 19 },
    { header: "仓库", key: "warehouse", width: 24 },
    { header: "SKU", key: "sku", width: 18 },
    { header: "商品名称", key: "productName", width: 32 },
    { header: "变动数量", key: "quantity", width: 13 },
    { header: "变动前", key: "before", width: 13 },
    { header: "变动后", key: "after", width: 13 },
    { header: "单位", key: "unit", width: 9 },
    { header: "来源单号", key: "reference", width: 24 },
    { header: "备注", key: "note", width: 32 },
  ];

  for (const movement of movements) {
    const item = relatedOne(movement.inventory_items);
    const warehouse = relatedOne(movement.warehouses);
    movementSheet.addRow({
      movementNo: safeText(movement.movement_no),
      type: movementLabel(movement.movement_type),
      createdAt: shanghaiExcelDateTime(new Date(movement.created_at)),
      warehouse: safeText(warehouse?.name),
      sku: safeText(item?.sku),
      productName: safeText(item?.product_name),
      quantity: Number(movement.quantity),
      before: Number(movement.before_quantity),
      after: Number(movement.after_quantity),
      unit: safeText(item?.unit),
      reference: safeText(movement.reference_no),
      note: safeText(movement.note),
    });
  }

  const styleDataSheet = (sheet: typeof stockSheet) => {
    const header = sheet.getRow(1);
    header.height = 30;
    header.font = {
      name: "PingFang SC",
      size: 10,
      bold: true,
      color: { argb: COLORS.white },
    };
    header.alignment = { vertical: "middle", horizontal: "center" };
    header.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: COLORS.primary },
      };
      cell.border = {
        bottom: { style: "medium", color: { argb: COLORS.gold } },
      };
    });
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: sheet.columnCount },
    };
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) {
        return;
      }
      row.font = {
        name: "PingFang SC",
        size: 10,
        color: { argb: COLORS.text },
      };
      row.alignment = { vertical: "middle" };
      row.eachCell((cell) => {
        cell.border = {
          bottom: { style: "hair", color: { argb: COLORS.border } },
        };
      });
    });
    sheet.pageSetup = {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: 0.25,
        right: 0.25,
        top: 0.5,
        bottom: 0.5,
        header: 0.2,
        footer: 0.2,
      },
    };
  };

  styleDataSheet(stockSheet);
  styleDataSheet(batchSheet);
  styleDataSheet(movementSheet);

  for (let rowNumber = 2; rowNumber <= stockSheet.rowCount; rowNumber += 1) {
    const row = stockSheet.getRow(rowNumber);
    for (let column = 10; column <= 16; column += 1) {
      row.getCell(column).numFmt = "#,##0";
    }
    const statusCell = row.getCell(17);
    if (statusCell.value === "存在隔离库存") {
      statusCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: COLORS.danger },
      };
      statusCell.font = { color: { argb: COLORS.dangerText }, bold: true };
    } else if (statusCell.value === "零库存" || statusCell.value === "低库存") {
      statusCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: COLORS.warning },
      };
      statusCell.font = { color: { argb: COLORS.warningText }, bold: true };
    }
  }

  for (let rowNumber = 2; rowNumber <= batchSheet.rowCount; rowNumber += 1) {
    const row = batchSheet.getRow(rowNumber);
    row.getCell(5).numFmt = "yyyy-mm-dd";
    row.getCell(7).numFmt = "yyyy-mm-dd";
    for (let column = 8; column <= 10; column += 1) {
      row.getCell(column).numFmt = "#,##0";
    }
    const statusCell = row.getCell(12);
    if (statusCell.value === "已到期隔离") {
      statusCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: COLORS.danger },
      };
      statusCell.font = { color: { argb: COLORS.dangerText }, bold: true };
    } else if (
      statusCell.value === "90天内到期" ||
      statusCell.value === "效期待补充"
    ) {
      statusCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: COLORS.warning },
      };
      statusCell.font = { color: { argb: COLORS.warningText }, bold: true };
    }
  }

  for (let rowNumber = 2; rowNumber <= movementSheet.rowCount; rowNumber += 1) {
    const row = movementSheet.getRow(rowNumber);
    row.getCell(3).numFmt = "yyyy-mm-dd hh:mm";
    for (let column = 7; column <= 9; column += 1) {
      row.getCell(column).numFmt = "#,##0";
    }
  }

  return workbook.xlsx.writeBuffer();
}

const WANWEI_GROUPS = [
  {
    key: "rice",
    title: "品名（米）",
    categories: new Set<InventoryExportItem["category"]>(["rice"]),
  },
  {
    key: "oil",
    title: "品名（油）",
    categories: new Set<InventoryExportItem["category"]>(["oil", "gift"]),
  },
  {
    key: "other",
    title: "品名（调味品&杂粮&面条）",
    categories: new Set<InventoryExportItem["category"]>([
      "other",
      "unknown",
    ]),
  },
] as const;

export async function buildWanweiInventoryWorkbook({
  employeeName,
  exportedAt,
  batches,
}: Pick<BuildInventoryWorkbookInput, "employeeName" | "exportedAt" | "batches">) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "德馨星云 DEXIN Nebula";
  workbook.lastModifiedBy = employeeName;
  workbook.created = exportedAt;
  workbook.modified = exportedAt;
  workbook.company = "长沙德馨淼盛科技有限公司";
  workbook.subject = "万纬仓库存量及商品效期";
  workbook.title = "万纬库存表";

  const sheet = workbook.addWorksheet("深国际库存表", {
    properties: { defaultRowHeight: 22 },
    views: [{ state: "frozen", ySplit: 1, showGridLines: false }],
  });
  sheet.columns = [
    { key: "productName", width: 34 },
    { key: "specification", width: 16 },
    { key: "quantity", width: 14 },
    { key: "productionDate", width: 15 },
    { key: "shelfLife", width: 13 },
    { key: "caseSpecification", width: 18 },
    { key: "barcode", width: 20 },
  ];

  const sourceBatches = [...batches].sort((left, right) => {
    const leftRow = left.source_row_no ?? Number.MAX_SAFE_INTEGER;
    const rightRow = right.source_row_no ?? Number.MAX_SAFE_INTEGER;
    return leftRow - rightRow;
  });
  const headerRows = new Set<number>();
  const expiryRiskByRow = new Map<number, "warning" | "danger">();

  for (const group of WANWEI_GROUPS) {
    const groupBatches = sourceBatches.filter((batch) => {
      const item = relatedOne(batch.inventory_items);
      return item ? group.categories.has(item.category) : false;
    });
    if (groupBatches.length === 0) {
      continue;
    }

    const header = sheet.addRow({
      productName: group.title,
      specification: "规格",
      quantity: "库存数量",
      productionDate: "生产日期",
      shelfLife: "保质期",
      caseSpecification: "箱规",
      barcode: "69条码",
    });
    headerRows.add(sheet.rowCount);
    header.height = 30;

    for (const batch of groupBatches) {
      const item = relatedOne(batch.inventory_items);
      sheet.addRow({
        productName: safeText(item?.product_name),
        specification: safeText(item?.specification),
        quantity: Number(batch.quantity),
        productionDate: compactDate(batch.production_date),
        shelfLife: batch.shelf_life_months
          ? `${batch.shelf_life_months}个月`
          : null,
        caseSpecification: safeText(item?.case_specification),
        barcode: safeText(item?.barcode),
      });

      const risk = expiryStatus(batch, exportedAt);
      if (risk === "已到期隔离" || risk === "90天内到期") {
        expiryRiskByRow.set(
          sheet.rowCount,
          risk === "已到期隔离" ? "danger" : "warning",
        );
      }
    }
  }

  sheet.eachRow((row, rowNumber) => {
    const isHeader = headerRows.has(rowNumber);
    row.height = isHeader ? 30 : 22;
    row.font = {
      name: "宋体",
      size: isHeader ? 14 : 11,
      bold: isHeader,
      color: { argb: COLORS.text },
    };
    row.alignment = {
      vertical: "middle",
      horizontal: "center",
    };
    for (let columnNumber = 1; columnNumber <= 7; columnNumber += 1) {
      const cell = row.getCell(columnNumber);
      cell.border = {
        top: { style: "hair", color: { argb: "4F5B58" } },
        bottom: { style: "hair", color: { argb: "4F5B58" } },
        left: { style: "hair", color: { argb: "4F5B58" } },
        right: { style: "hair", color: { argb: "4F5B58" } },
      };
      if (isHeader) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "A9E2DF" },
        };
      }
    }

    if (!isHeader) {
      row.getCell(3).numFmt = "#,##0";
      row.getCell(4).numFmt = "@";
      row.getCell(7).numFmt = "@";
      const risk = expiryRiskByRow.get(rowNumber);
      if (risk) {
        row.getCell(4).font = {
          name: "宋体",
          size: 11,
          bold: true,
          color: {
            argb: risk === "danger" ? COLORS.dangerText : COLORS.warningText,
          },
        };
      }
    }
  });

  if (sheet.rowCount > 0) {
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: sheet.rowCount, column: 7 },
    };
  }
  sheet.pageSetup = {
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: {
      left: 0.25,
      right: 0.25,
      top: 0.45,
      bottom: 0.45,
      header: 0.2,
      footer: 0.2,
    },
  };

  return workbook.xlsx.writeBuffer();
}
