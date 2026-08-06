declare module "@excel.js/exceljs" {
  type ArgbColor = { argb: string };
  type Fill = {
    type: "pattern";
    pattern: "solid";
    fgColor: ArgbColor;
  };
  type Font = {
    name?: string;
    size?: number;
    bold?: boolean;
    color?: ArgbColor;
  };
  type Alignment = {
    vertical?: "middle";
    horizontal?: "left" | "center";
  };
  type Border = {
    top?: {
      style: "hair" | "medium";
      color: ArgbColor;
    };
    bottom?: {
      style: "hair" | "medium";
      color: ArgbColor;
    };
    left?: {
      style: "hair" | "medium";
      color: ArgbColor;
    };
    right?: {
      style: "hair" | "medium";
      color: ArgbColor;
    };
  };

  interface Cell {
    value: unknown;
    numFmt: string;
    font: Font;
    alignment: Alignment;
    fill: Fill;
    border: Border;
  }

  interface Row {
    height: number;
    font: Font;
    alignment: Alignment;
    getCell(column: number): Cell;
    eachCell(callback: (cell: Cell) => void): void;
  }

  type WorksheetColumn = {
    header?: string;
    key?: string;
    width?: number;
  };

  interface Worksheet {
    columns: WorksheetColumn[];
    readonly columnCount: number;
    readonly rowCount: number;
    autoFilter: {
      from: { row: number; column: number };
      to: { row: number; column: number };
    };
    pageSetup: {
      orientation: "landscape";
      fitToPage: boolean;
      fitToWidth: number;
      fitToHeight: number;
      margins: {
        left: number;
        right: number;
        top: number;
        bottom: number;
        header: number;
        footer: number;
      };
    };
    mergeCells(range: string): void;
    mergeCells(
      startRow: number,
      startColumn: number,
      endRow: number,
      endColumn: number,
    ): void;
    getCell(address: string): Cell;
    getCell(row: number, column: number): Cell;
    getRow(row: number): Row;
    addRow(values: Record<string, unknown>): Row;
    eachRow(callback: (row: Row, rowNumber: number) => void): void;
  }

  type WorksheetOptions = {
    properties?: { defaultRowHeight?: number };
    views?: Array<{
      state?: "frozen";
      ySplit?: number;
      showGridLines?: boolean;
    }>;
  };

  interface Workbook {
    creator: string;
    lastModifiedBy: string;
    created: Date;
    modified: Date;
    company: string;
    subject: string;
    title: string;
    readonly xlsx: {
      writeBuffer(): Promise<ArrayBuffer>;
    };
    addWorksheet(name: string, options?: WorksheetOptions): Worksheet;
  }

  const ExcelJS: {
    Workbook: new () => Workbook;
  };

  export default ExcelJS;
}
