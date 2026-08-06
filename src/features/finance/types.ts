export type FinanceDocumentType = "receivable" | "payable";

export type FinanceDocumentSource =
  | "manual"
  | "order"
  | "purchase"
  | "expense"
  | "other";

export type FinanceDocumentStatus = "open" | "partial" | "settled" | "void";

export type FinanceDocumentRow = {
  id: string;
  document_no: string;
  document_type: FinanceDocumentType;
  counterparty_name: string;
  source_type: FinanceDocumentSource;
  source_no: string | null;
  issue_date: string;
  due_date: string;
  total_amount: number;
  settled_amount: number;
  status: FinanceDocumentStatus;
  invoice_no: string | null;
  summary: string;
  note: string | null;
  updated_at: string;
};

export type FinanceDocumentUpdate = {
  id: string;
  expectedUpdatedAt: string;
  documentType: FinanceDocumentType;
  counterpartyName: string;
  sourceType: FinanceDocumentSource;
  sourceNo: string;
  issueDate: string;
  dueDate: string;
  totalAmount: number;
  invoiceNo: string;
  summary: string;
  note: string;
  status: FinanceDocumentStatus;
};
