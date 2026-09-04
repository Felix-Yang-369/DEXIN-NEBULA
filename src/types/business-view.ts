export type BusinessViewSort = {
  key: string;
  direction: "asc" | "desc";
};

export type BusinessViewConfig = {
  visibleColumns: string[];
  columnOrder: string[];
  columnWidths: Record<string, number>;
  stickyColumns: string[];
  sort?: BusinessViewSort;
  filters: Record<string, string | string[]>;
  pageSize: 20 | 50 | 100;
  density: "compact";
};

export type SavedBusinessView = {
  id: string;
  name: string;
  config: Partial<BusinessViewConfig>;
  updated_at: string;
};
