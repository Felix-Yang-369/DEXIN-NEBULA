export type BiPeriod = "3m" | "6m" | "12m" | "all";

export type BiKpi = {
  key: "customers" | "receivables" | "orders" | "inventory" | "warnings" | "employees";
  label: string;
  value: number;
  format: "number" | "currency";
  note: string;
  sourceAvailable: boolean;
};

export type NamedValue = {
  name: string;
  value: number;
  secondary?: number;
};

export type ReceivableRanking = {
  name: string;
  outstanding: number;
  documentCount: number;
};

export type DataCoverageItem = {
  label: string;
  records: number;
  status: "ready" | "limited" | "empty" | "restricted";
  note: string;
};

export type BiData = {
  generatedAt: string;
  period: BiPeriod;
  kpis: BiKpi[];
  customerLevels: NamedValue[];
  receivableAging: NamedValue[];
  receivableRanking: ReceivableRanking[];
  inventoryCategories: NamedValue[];
  departmentHeadcount: NamedValue[];
  orderStatuses: NamedValue[];
  coverage: DataCoverageItem[];
  warnings: string[];
};
